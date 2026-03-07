#include "game.hpp"
#include <algorithm>
#include <cmath>
#include <vector>
#include "world/world.hpp"
#include "constants/controls.hpp"
#include "constants/physics.hpp"
#include "physics/collider.hpp"

void Game::init(IRenderer& renderer, uint32_t width, uint32_t height)
{
    m_renderer = &renderer;
    m_width    = width;
    m_height   = height;

    // Position camera at the world's designated start chunk.
    const float camX = (World::CAM_START_CX + 0.5f) * Chunk::SIZE;
    const float camY = static_cast<float>(World::CAM_START_CY) * Chunk::SIZE;
    const float camZ = (World::CAM_START_CZ + 0.5f) * Chunk::SIZE;
    m_camera.setPosition(camX, camY, camZ);

    // Create the MVP uniform buffer with the initial matrix.
    m_uniformBuf = renderer.createBuffer(BufferType::Uniform, sizeof(Mat4));
    rebuildMVP();

    // Compile shaders and create the terrain render pipeline (no mesh data yet).
    m_worldRenderer.init(renderer);
}

void Game::loadWorld(ProgressFn worldProgress, ProgressFn meshProgress)
{
    World::instance().init(std::move(worldProgress));
    m_worldRenderer.buildMeshes(*m_renderer, World::instance(), std::move(meshProgress));
}

void Game::update(float dt)
{
    // --- Gravity ---
    m_velY -= PhysicsConstants::kGravity * dt;
    if (m_velY < -PhysicsConstants::kTerminalVelocity)
        m_velY = -PhysicsConstants::kTerminalVelocity;

    // --- Camera rotation + horizontal movement ---
    m_camera.update(dt);

    // --- Async chunk + mesh pipeline ---
    // Flush completed meshes every frame (just pointer swaps, very cheap).
    m_worldRenderer.flushReadyMeshes();

    // Only modify world data / dispatch mesh jobs when no background thread is
    // reading chunk data for meshing (safety invariant, prevents data races).
    if (m_worldRenderer.activeMeshJobs() == 0) {
        // 1. Advance the sliding window: shuffles chunk pointers, dispatches async
        //    I/O for new slots, saves evicted chunks async.  Returns fast.
        World::ShiftResult shift =
            World::instance().update(m_camera.x(), m_camera.y(), m_camera.z());

        if (shift.moved)
            m_worldRenderer.applyWindowShift(shift);

        // 2. Swap in any chunks that finished loading/generating since last frame.
        std::vector<uint32_t> newSlots = World::instance().flushReadyChunks();

        // 3. Build meshes for newly arrived chunks + their face-neighbours
        //    (neighbours need a remesh for correct cross-chunk border geometry).
        if (!newSlots.empty()) {
            std::vector<uint32_t> toRebuild;
            toRebuild.reserve(newSlots.size() * 7);

            for (uint32_t slot : newSlots) {
                toRebuild.push_back(slot);
                const uint32_t cx = slot % World::SIZE;
                const uint32_t cy = (slot / World::SIZE) % World::SIZE_Y;
                const uint32_t cz = slot / (World::SIZE * World::SIZE_Y);

                std::function<void(int, int, int)> addNeighbour =
                    [&](int dx, int dy, int dz) {
                        const int nx = static_cast<int>(cx) + dx;
                        const int ny = static_cast<int>(cy) + dy;
                        const int nz = static_cast<int>(cz) + dz;
                        if (nx >= 0 && nx < static_cast<int>(World::SIZE) &&
                            ny >= 0 && ny < static_cast<int>(World::SIZE_Y) &&
                            nz >= 0 && nz < static_cast<int>(World::SIZE))
                            toRebuild.push_back(
                                static_cast<uint32_t>(nx)
                                + World::SIZE * (static_cast<uint32_t>(ny)
                                + World::SIZE_Y * static_cast<uint32_t>(nz)));
                    };

                addNeighbour(-1,0,0); addNeighbour(1,0,0);
                addNeighbour(0,-1,0); addNeighbour(0,1,0);
                addNeighbour(0,0,-1); addNeighbour(0,0,1);
            }

            m_worldRenderer.buildMeshesAsync(*m_renderer, World::instance(), toRebuild);
        }
    }

    // --- Physics ---
    // The camera stores the eye Y = bodyCenter + kEyeOffset.
    // Collision functions operate on the body centre.
    float camX = m_camera.x();
    float camY = m_camera.y() - PhysicsConstants::kEyeOffset;
    float camZ = m_camera.z();

    Collider::resolveXZ(camX, camY, camZ, World::instance());

    // Sub-step vertical integration to prevent tunnelling through thin surfaces.
    const float totalDeltaY = m_velY * dt;
    const int nSteps = std::max(1, static_cast<int>(
        std::ceil(std::abs(totalDeltaY) / PhysicsConstants::kMaxSubStepY)));
    const float stepY = totalDeltaY / static_cast<float>(nSteps);

    for (int i = 0; i < nSteps; ++i) {
        camY += stepY;
        Collider::resolveY(camX, camY, camZ, World::instance());
    }

    m_grounded = Collider::isGrounded(camX, camY, camZ, World::instance());
    if (m_grounded && m_velY < 0.0f)
        m_velY = 0.0f;

    m_camera.setPosition(camX, camY + PhysicsConstants::kEyeOffset, camZ);

    rebuildMVP();
}

void Game::render(ICommandBuffer& cmd)
{
    m_worldRenderer.render(cmd, *m_uniformBuf);
}

void Game::resize(uint32_t width, uint32_t height)
{
    m_width  = width;
    m_height = height;
    rebuildMVP();
}

void Game::keyDown(uint16_t code)
{
    if (code == Controls::kJump) {
        if (m_grounded) {
            m_velY     = PhysicsConstants::kJumpForce;
            m_grounded = false;
        }
        return;  // Space is not forwarded to the camera
    }
    m_camera.keyDown(code);
}

void Game::keyUp(uint16_t code)
{
    m_camera.keyUp(code);
}

void Game::mouseDelta(float dx, float dy)
{
    m_camera.mouseDelta(dx, dy);
}

void Game::rebuildMVP()
{
    if (!m_uniformBuf) return;
    Mat4 proj = Mat4::perspective(
        0.8727f,
        static_cast<float>(m_width) / static_cast<float>(m_height),
        1.0f, 4000.0f);
    Mat4 mvp = Mat4::multiply(proj, m_camera.viewMatrix());
    m_uniformBuf->upload(&mvp, sizeof(Mat4));
}
