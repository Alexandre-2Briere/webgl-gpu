#pragma once
#include <atomic>
#include <functional>
#include <memory>
#include <mutex>
#include <vector>
#include "renderer/IRenderer.h"
#include "renderer/IBuffer.h"
#include "renderer/IShader.h"
#include "renderer/IRenderPipeline.h"
#include "world.hpp"

/// Generates GPU vertex buffers for every loaded chunk and submits draw calls.
/// Owns the pipeline + shaders; the uniform buffer (MVP) is owned by the caller.
class WorldRenderer {
public:
    WorldRenderer();
    ~WorldRenderer() = default;

    /// Build shaders, pipeline, and per-chunk vertex buffers.
    /// Must be called once after the renderer is initialised.
    void init(IRenderer& renderer);

    /// Synchronous full rebuild — used during the loading screen (already on a
    /// background thread).  Do NOT call during normal gameplay.
    void buildMeshes(IRenderer& renderer, const World& world,
                     std::function<void(uint32_t, uint32_t)> progress = {});

    /// Apply a window shift without any mesh rebuilding: move existing meshes to
    /// their new slots and clear the slots that now need new chunks.
    /// Call immediately after World::update() when ShiftResult::moved is true.
    void applyWindowShift(const World::ShiftResult& shift);

    /// Dispatch mesh generation for the given slot indices to background threads.
    /// Each completed mesh is queued internally; call flushReadyMeshes() each frame
    /// to upload them to the GPU on the main thread.
    /// Safe to call only when activeMeshJobs() == 0 (no concurrent world reads).
    void buildMeshesAsync(IRenderer& renderer, const World& world,
                          const std::vector<uint32_t>& slots);

    /// Swap in any meshes that finished building on background threads.
    /// Call once per frame on the main thread, before rendering.
    /// Returns true if any mesh was updated.
    bool flushReadyMeshes();

    /// Number of mesh-build jobs still running on background threads.
    int activeMeshJobs() const { return m_activeMeshJobs.load(); }

    /// Issue draw calls for all chunks with geometry.
    void render(ICommandBuffer& cmd, IBuffer& uniformBuf) const;

private:
    struct ChunkMesh {
        std::unique_ptr<IBuffer> vertexBuffer;
        uint32_t                 vertexCount = 0;
    };

    struct ReadyMesh {
        uint32_t                 idx;
        std::unique_ptr<IBuffer> vertexBuffer;
        uint32_t                 vertexCount = 0;
    };

    static constexpr uint32_t MAX_CHUNKS =
        World::SIZE * World::SIZE_Y * World::SIZE;

    ChunkMesh                        m_meshes[MAX_CHUNKS];
    std::unique_ptr<IShader>         m_vertShader;
    std::unique_ptr<IShader>         m_fragShader;
    std::unique_ptr<IRenderPipeline> m_pipeline;

    // Crosshair: small black dot drawn at screen centre with depth test disabled.
    std::unique_ptr<IShader>         m_crosshairVertShader;
    std::unique_ptr<IShader>         m_crosshairFragShader;
    std::unique_ptr<IRenderPipeline> m_crosshairPipeline;

    mutable std::mutex       m_readyMeshMutex;
    std::vector<ReadyMesh>   m_readyMeshes;
    std::atomic<int>         m_activeMeshJobs{0};
};
