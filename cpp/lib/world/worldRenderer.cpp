#include "worldRenderer.hpp"
#include "marchingCubes/mesher.hpp"
#include "marchingCubes/vertex.hpp"
#include "renderer/ICommandBuffer.h"
#include "renderer/metal/MetalRenderer.hpp"  // for createShaderWithName + nativeDevice
#include <dispatch/dispatch.h>

// ---------------------------------------------------------------------------
// Crosshair MSL — 6 vertices (2 triangles) generated from vertex_id.
// No vertex buffer required. The quad spans ±0.01 NDC; the fragment shader
// discards pixels outside the inscribed circle, giving a solid black dot.
// ---------------------------------------------------------------------------
static const char* kCrosshairMSL = R"(
#include <metal_stdlib>
using namespace metal;

struct CrosshairOut {
    float4 position [[position]];
    float2 uv;
};

// Two triangles forming a ±0.01 NDC quad at screen centre.
// Must be at file scope: MSL does not allow constant-address-space local variables.
constant float4 kCrosshairData[6] = {
    float4(-0.01f, -0.01f, 0.0f, 0.0f),
    float4( 0.01f, -0.01f, 1.0f, 0.0f),
    float4(-0.01f,  0.01f, 0.0f, 1.0f),
    float4(-0.01f,  0.01f, 0.0f, 1.0f),
    float4( 0.01f, -0.01f, 1.0f, 0.0f),
    float4( 0.01f,  0.01f, 1.0f, 1.0f),
};

vertex CrosshairOut crosshairVert(uint vid [[vertex_id]])
{
    CrosshairOut out;
    out.position = float4(kCrosshairData[vid].xy, 0.0f, 1.0f);
    out.uv       = kCrosshairData[vid].zw;
    return out;
}

fragment float4 crosshairFrag(CrosshairOut in [[stage_in]])
{
    // Remap [0,1]^2 UV to [-1,1]^2; discard outside unit circle → round dot.
    float2 uv = in.uv * 2.0f - 1.0f;
    if (length(uv) > 1.0f) discard_fragment();
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
)";

// ---------------------------------------------------------------------------
// MSL shader source — simple diffuse + ambient shading.
// The vertex struct layout (float3 position, float3 normal) must match
// MetalPipeline's vertex descriptor (stride 24, attributes 0 and 1).
// ---------------------------------------------------------------------------
static const char* kMSLSource = R"(
#include <metal_stdlib>
using namespace metal;

struct VertIn {
    float3 position [[attribute(0)]];
    float3 normal   [[attribute(1)]];
};

struct VertOut {
    float4 position [[position]];
    float3 normal;
};

struct Uniforms {
    float4x4 mvp;
};

vertex VertOut vertexMain(VertIn in [[stage_in]],
                          constant Uniforms& u [[buffer(1)]])
{
    VertOut out;
    out.position = u.mvp * float4(in.position, 1.0);
    out.normal   = in.normal;
    return out;
}

fragment float4 fragmentMain(VertOut in [[stage_in]])
{
    float3 lightDir = normalize(float3(0.6, 1.0, 0.4));
    float  diffuse  = max(dot(normalize(in.normal), lightDir), 0.0);
    float3 color    = float3(0.35, 0.55, 0.25) * (diffuse * 0.8 + 0.2);
    return float4(color, 1.0);
}
)";

// ---------------------------------------------------------------------------
WorldRenderer::WorldRenderer() = default;

void WorldRenderer::init(IRenderer& renderer)
{
    // WorldRenderer needs Metal-specific shader creation; we downcast here.
    // This is the only file that touches Metal internals outside the metal/ folder.
    // If another backend is added, add a branch or move shader creation into IRenderer.
    MetalRenderer* mr = dynamic_cast<MetalRenderer*>(&renderer);

    if (mr) {
        m_vertShader = mr->createShaderWithName(kMSLSource, "vertexMain");
        m_fragShader = mr->createShaderWithName(kMSLSource, "fragmentMain");
    }

    PipelineDesc pd;
    pd.vertex   = m_vertShader.get();
    pd.fragment = m_fragShader.get();
    m_pipeline  = renderer.createPipeline(pd);

    // --- Crosshair pipeline (no depth test, no vertex buffer) ---
    if (mr) {
        m_crosshairVertShader = mr->createShaderWithName(kCrosshairMSL, "crosshairVert");
        m_crosshairFragShader = mr->createShaderWithName(kCrosshairMSL, "crosshairFrag");
    }
    PipelineDesc cpd;
    cpd.vertex             = m_crosshairVertShader.get();
    cpd.fragment           = m_crosshairFragShader.get();
    cpd.depthTest          = false;
    cpd.noVertexDescriptor = true;
    m_crosshairPipeline = renderer.createPipeline(cpd);
}

void WorldRenderer::buildMeshes(IRenderer& renderer, const World& world,
                                std::function<void(uint32_t, uint32_t)> progress)
{
    constexpr uint32_t total = World::SIZE * World::SIZE_Y * World::SIZE;
    uint32_t done = 0;

    for (uint32_t cz = 0; cz < World::SIZE; ++cz)
    for (uint32_t cy = 0; cy < World::SIZE_Y; ++cy)
    for (uint32_t cx = 0; cx < World::SIZE; ++cx)
    {
        const Chunk* chunk = world.chunkAt(cx, cy, cz);
        if (chunk) {
            uint32_t idx = cx + World::SIZE * (cy + World::SIZE_Y * cz);

            std::vector<Vertex> verts = Mesher::generate(world,
                chunk->gridX(),
                chunk->gridY(),
                chunk->gridZ());

            if (!verts.empty()) {
                size_t bytes = verts.size() * sizeof(Vertex);
                m_meshes[idx].vertexBuffer = renderer.createBuffer(BufferType::Vertex, bytes);
                m_meshes[idx].vertexBuffer->upload(verts.data(), bytes);
                m_meshes[idx].vertexCount  = static_cast<uint32_t>(verts.size());
            }
        }
        ++done;
        if (progress && (done % 50 == 0 || done == total))
            progress(done, total);
    }
}

void WorldRenderer::applyWindowShift(const World::ShiftResult& shift)
{
    // Collect all source meshes into a temp array, then place them at destinations.
    // Using a full-size temp array handles cycles correctly in one pass.
    ChunkMesh tmp[MAX_CHUNKS];
    for (auto& mv : shift.meshMoves)
        tmp[mv.to] = std::move(m_meshes[mv.from]);
    // clearedSlots stay as empty ChunkMesh in tmp (default-initialised).
    for (uint32_t i = 0; i < MAX_CHUNKS; ++i)
        m_meshes[i] = std::move(tmp[i]);
}

void WorldRenderer::buildMeshesAsync(IRenderer& renderer, const World& world,
                                     const std::vector<uint32_t>& slots)
{
    IRenderer*    rptr = &renderer;
    const World*  wptr = &world;
    WorldRenderer* self = this;

    for (uint32_t slot : slots) {
        uint32_t cx = slot % World::SIZE;
        uint32_t cy = (slot / World::SIZE) % World::SIZE_Y;
        uint32_t cz = slot / (World::SIZE * World::SIZE_Y);
        const Chunk* chunk = world.chunkAt(cx, cy, cz);

        // Null slot (chunk not loaded yet): clear stale geometry immediately.
        if (!chunk) {
            m_meshes[slot].vertexCount = 0;
            m_meshes[slot].vertexBuffer.reset();
            continue;
        }

        int32_t gx = chunk->gridX();
        int32_t gy = chunk->gridY();
        int32_t gz = chunk->gridZ();

        m_activeMeshJobs++;
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
            std::vector<Vertex> verts = Mesher::generate(*wptr, gx, gy, gz);

            ReadyMesh rm;
            rm.idx        = slot;
            rm.vertexCount = 0;
            if (!verts.empty()) {
                size_t bytes = verts.size() * sizeof(Vertex);
                rm.vertexBuffer = rptr->createBuffer(BufferType::Vertex, bytes);
                rm.vertexBuffer->upload(verts.data(), bytes);
                rm.vertexCount  = static_cast<uint32_t>(verts.size());
            }
            {
                std::lock_guard<std::mutex> lock(self->m_readyMeshMutex);
                self->m_readyMeshes.push_back(std::move(rm));
            }
            self->m_activeMeshJobs--;
        });
    }
}

bool WorldRenderer::flushReadyMeshes()
{
    std::vector<ReadyMesh> batch;
    {
        std::lock_guard<std::mutex> lock(m_readyMeshMutex);
        if (m_readyMeshes.empty()) return false;
        batch = std::move(m_readyMeshes);
    }
    for (auto& rm : batch) {
        m_meshes[rm.idx].vertexBuffer = std::move(rm.vertexBuffer);
        m_meshes[rm.idx].vertexCount  = rm.vertexCount;
    }
    return true;
}

void WorldRenderer::render(ICommandBuffer& cmd, IBuffer& uniformBuf) const
{
    cmd.setPipeline(m_pipeline.get());
    cmd.setUniformBuffer(&uniformBuf, 1);

    for (uint32_t i = 0; i < MAX_CHUNKS; ++i) {
        if (!m_meshes[i].vertexBuffer || m_meshes[i].vertexCount == 0) continue;
        cmd.setVertexBuffer(m_meshes[i].vertexBuffer.get(), 0);
        cmd.draw(m_meshes[i].vertexCount);
    }

    // Draw crosshair dot on top of everything (depth test disabled in pipeline).
    if (m_crosshairPipeline) {
        cmd.setPipeline(m_crosshairPipeline.get());
        cmd.draw(6);  // 6 vertices — 2 triangles from vertex_id, no vertex buffer needed
    }
}
