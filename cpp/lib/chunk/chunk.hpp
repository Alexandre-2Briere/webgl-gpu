#pragma once
#include <cstdint>
#include <filesystem>
#include <string>
#include "../corner/corner.hpp"

/// A 32³ marching-cubes chunk.
///
/// Memory layout: flat array, index = x + SIZE * (y + SIZE * z).
/// Total size: 32³ × sizeof(Corner) = 32 768 × 2 = 64 KiB.
///
/// Fill strategies live in lib/utils/chunkFill.hpp so they can be swapped
/// (random → Perlin noise → SDF, etc.) without touching this class.
class Chunk {
public:
    static constexpr uint32_t SIZE = 32;

    /// Default ctor leaves coordinates at (0,0,0).  Use the parameterised
    /// constructor or `setGridCoordinate` to assign a position before calling
    /// `fill()`.
    Chunk(int32_t cx = 0, int32_t cy = 0, int32_t cz = 0) noexcept
        : m_gridX(cx), m_gridY(cy), m_gridZ(cz) {}

    /// Fills all corners using the terrain plane fill strategy.  The
    /// chunk uses its internally‑stored grid coordinates (set at creation or
    /// via `setGridCoordinate`) so callers no longer need to pass them.
    void fill();

    /// Corner access — no bounds check, caller must ensure x/y/z < SIZE.
    const Corner& at(uint32_t x, uint32_t y, uint32_t z) const noexcept;
    Corner&       at(uint32_t x, uint32_t y, uint32_t z) noexcept;

    /// Raw pointer to the flat corner array — used by the renderer and fill utils.
    const Corner* data() const noexcept;

    static constexpr uint32_t cornerCount() noexcept { return SIZE * SIZE * SIZE; }

    /// Serialization helpers.  Chunks are saved as plain-text density values
    /// so the world can be unloaded and reloaded between runs.  Files live in
    /// a `world` directory; the name is `<X>_<Y>_<Z>_chunk` where the X/Y/Z
    /// are the chunk-space coordinates.
    bool saveToDirectory(const std::filesystem::path& dir) const;
    static std::unique_ptr<Chunk> loadFromDirectory(const std::filesystem::path& dir,
                                                     int32_t gx, int32_t gy, int32_t gz);

    /// Assign the chunk's position in chunk-space.  This is the value used
    /// by `fill()` and will later drive infinite-world logic.
    void setGridCoordinate(int32_t cx, int32_t cy, int32_t cz) noexcept;
    int32_t gridX() const noexcept;
    int32_t gridY() const noexcept;
    int32_t gridZ() const noexcept;

private:
    static constexpr uint32_t idx(uint32_t x, uint32_t y, uint32_t z) noexcept
    {
        return x + SIZE * (y + SIZE * z);
    }

    Corner m_corners[SIZE * SIZE * SIZE];

    // grid coordinates inside the world.  These replace the previous float
    // offsets and make each chunk responsible for its own position.  They'll
    // be crucial once we implement camera-relative loading/unloading.
    int32_t m_gridX = 0;
    int32_t m_gridY = 0;
    int32_t m_gridZ = 0;
};
