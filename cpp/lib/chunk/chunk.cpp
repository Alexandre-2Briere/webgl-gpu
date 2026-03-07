#include "chunk.hpp"
#include "../utils/chunkFill.hpp"
#include <fstream>
#include <sstream>

void Chunk::fill()
{
    ChunkFill::plane(m_corners, m_gridX, m_gridY, m_gridZ);
}

void Chunk::setGridCoordinate(int32_t cx, int32_t cy, int32_t cz) noexcept
{
    m_gridX = cx;
    m_gridY = cy;
    m_gridZ = cz;
}

// --------------------------------------------------------------------------
// Serialization
// --------------------------------------------------------------------------

static std::filesystem::path chunkFilePath(const std::filesystem::path& dir,
                                           int32_t gx, int32_t gy, int32_t gz)
{
    std::ostringstream oss;
    oss << gx << '_' << gy << '_' << gz << "_chunk";
    return dir / oss.str();
}

bool Chunk::saveToDirectory(const std::filesystem::path& dir) const
{
    std::filesystem::create_directories(dir);
    std::filesystem::path path = chunkFilePath(dir, m_gridX, m_gridY, m_gridZ);
    std::ofstream ofs(path);
    if (!ofs) return false;

    // dump raw densities in row-major order separated by spaces to keep it
    // simple and human-readable.
    const Corner* ptr = m_corners;
    const uint32_t count = cornerCount();
    for (uint32_t i = 0; i < count; ++i) {
        ofs << ptr[i].getValue();
        if (i + 1 < count) ofs << ' ';
    }
    return true;
}

std::unique_ptr<Chunk> Chunk::loadFromDirectory(const std::filesystem::path& dir,
                                                 int32_t gx, int32_t gy, int32_t gz)
{
    std::filesystem::path path = chunkFilePath(dir, gx, gy, gz);
    std::ifstream ifs(path);
    if (!ifs) return nullptr;

    auto chunk = std::make_unique<Chunk>(gx, gy, gz);
    const uint32_t count = cornerCount();
    for (uint32_t i = 0; i < count; ++i) {
        float v;
        ifs >> v;
        chunk->m_corners[i].setValue(v);
    }
    return chunk;
}

int32_t Chunk::gridX() const noexcept { return m_gridX; }
int32_t Chunk::gridY() const noexcept { return m_gridY; }
int32_t Chunk::gridZ() const noexcept { return m_gridZ; }

const Corner& Chunk::at(uint32_t x, uint32_t y, uint32_t z) const noexcept
{
    return m_corners[idx(x, y, z)];
}

Corner& Chunk::at(uint32_t x, uint32_t y, uint32_t z) noexcept
{
    return m_corners[idx(x, y, z)];
}

const Corner* Chunk::data() const noexcept { return m_corners; }
