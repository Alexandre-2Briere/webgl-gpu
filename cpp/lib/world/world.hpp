#pragma once
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <vector>
#include "../chunk/chunk.hpp"

/// Manages a 9×9×9 grid of chunks centered around the camera.
///
/// World coordinates are chunk-space integers (cx, cy, cz) in [0, SIZE).
/// The camera starts at the top of the center column: (RADIUS, SIZE-1, RADIUS).
///
/// Chunk loading/unloading as the camera moves is stubbed for now.
/// Chunks are heap-allocated (each is 64 KiB); null slot = not loaded.
///
/// Singleton — acquire via World::instance(), release via World::destroy().
class World {
public:
    static constexpr uint32_t SIZE     = 9;          // chunks per X/Z axis (odd → clean center)
    static constexpr uint32_t SIZE_Y   = 9;           // chunks per Y axis (odd → clean center)
    static constexpr uint32_t RADIUS   = SIZE   / 2;  // 8 — chunks from center to edge (X/Z)
    static constexpr uint32_t RADIUS_Y = SIZE_Y / 2;  // chunks from center to edge (Y)

    /// Chunk coordinate of the camera's initial position.
    /// Ground sits at world-chunk Y = 5 (floor(kBaseHeight / Chunk::SIZE) = floor(190/32)).
    /// CAM_START_CY = groundChunkY + RADIUS_Y places the camera at the TOP of the
    /// SIZE_Y window so the ground lands at the MIDDLE (local y = RADIUS_Y).
    static constexpr int CAM_START_CX = static_cast<int>(RADIUS);
    static constexpr int CAM_START_CY = 5 + static_cast<int>(RADIUS_Y); // groundChunkY(5) + RADIUS_Y
    static constexpr int CAM_START_CZ = static_cast<int>(RADIUS);

    /// Returns the single World instance, creating it on first call.
    static World& instance();

    /// Destroys the singleton and frees all chunks. Safe to call even if
    /// instance() was never called (no-op). After this, instance() creates fresh.
    static void destroy();

    // Non-copyable, non-movable.
    World(const World&)            = delete;
    World& operator=(const World&) = delete;
    World(World&&)                 = delete;
    World& operator=(World&&)      = delete;

    /// Creates and fills all SIZE³ chunks. Each chunk is given its grid
    /// coordinates before being filled so it can act as a self‑contained
    /// piece of the infinite world. Call this once at startup.
    /// @param progress  Optional callback invoked after each chunk is ready,
    ///                  with (chunksLoaded, totalChunks).
    void init(std::function<void(uint32_t, uint32_t)> progress = {});

    /// Describes the slot remapping caused by a sliding-window shift.
    struct ShiftResult {
        bool moved = false;
        struct SlotMove { uint32_t from, to; };
        std::vector<SlotMove> meshMoves;     ///< reused chunks: old slot → new slot
        std::vector<uint32_t> clearedSlots;  ///< new null slots waiting for async load
    };

    /// Call once per frame with the *world-space* camera position.
    /// Detects chunk-boundary crossings, shuffles the window, and dispatches
    /// async I/O for new slots.  Returns a ShiftResult so the caller can move
    /// existing GPU meshes without rebuilding them.
    ShiftResult update(float camX, float camY, float camZ);

    /// Returns the chunk at chunk-space position, or nullptr if not loaded.
    const Chunk* chunkAt(int cx, int cy, int cz) const noexcept;

    /// Returns true if the terrain corner at integer world-space coordinates
    /// (wx, wy, wz) has a density ≥ 0.5 (the marching-cubes ISO level).
    /// Out-of-bounds or unloaded positions return false.
    bool isSolidAt(int wx, int wy, int wz) const noexcept;

    /// Returns the raw scalar-field density [0, 1] at integer world coordinates.
    /// Out-of-bounds or unloaded positions return 0 (air).
    float densityAt(int wx, int wy, int wz) const noexcept;

    /// Call once per frame on the main thread (before rendering).
    /// Swaps in any chunks that finished loading/generating on background threads.
    /// Returns the flat slot indices of slots that received a new chunk.
    std::vector<uint32_t> flushReadyChunks();

private:
    World();
    ~World();

    static constexpr uint32_t idx(uint32_t cx, uint32_t cy, uint32_t cz) noexcept
    {
        return cx + SIZE * (cy + SIZE_Y * cz);
    }

    static World* s_instance;

    // coordinate of the chunk at m_chunks[0] in world chunk space
    int32_t m_originX = 0;
    int32_t m_originY = 0;
    int32_t m_originZ = 0;

    // last camera chunk we observed, used to detect movement
    int32_t m_lastCamChunkX = CAM_START_CX;
    int32_t m_lastCamChunkY = CAM_START_CY;
    int32_t m_lastCamChunkZ = CAM_START_CZ;

    std::unique_ptr<Chunk> m_chunks[SIZE * SIZE_Y * SIZE]; // SIZE×SIZE_Y×SIZE slots, nullptr = unloaded

    // Async chunk loading/generation pipeline.
    // Background threads push here; flushReadyChunks() drains on the main thread.
    struct ReadyChunk { int32_t wx, wy, wz; std::unique_ptr<Chunk> chunk; };
    mutable std::mutex      m_readyMutex;
    std::vector<ReadyChunk> m_ready;
};
