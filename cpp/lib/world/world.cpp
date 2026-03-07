#include "world.hpp"
#include "../constants/terrain.hpp"
#include <iostream>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <dispatch/dispatch.h>

// --------------------------------------------------------------------------
// Singleton bookkeeping
// --------------------------------------------------------------------------

World* World::s_instance = nullptr;

World& World::instance()
{
    if (!s_instance)
        s_instance = new World();
    return *s_instance;
}

void World::destroy()
{
    delete s_instance;
    s_instance = nullptr;
}

// --------------------------------------------------------------------------
// Constructor / destructor
// --------------------------------------------------------------------------

World::World() = default;

World::~World()
{
    // Explicitly reset every slot so chunks are destroyed in order before the
    // array itself goes away. unique_ptr would do this automatically, but
    // being explicit makes the intent clear and is easier to extend (e.g.
    // trigger GPU resource cleanup per-chunk in the future).
    constexpr uint32_t total = SIZE * SIZE_Y * SIZE;
    for (uint32_t i = 0; i < total; ++i)
        m_chunks[i].reset();
}

namespace {

// Helper calculating index in flat array; identical to World::idx but needed
// outside class scope.
constexpr uint32_t localIdx(uint32_t cx, uint32_t cy, uint32_t cz) noexcept
{
    return cx + World::SIZE * (cy + World::SIZE_Y * cz);
}

// Determine chunk-space coordinate from world-space float position.  We use
// floor so that negative positions map correctly (e.g. -0.1 → -1).
inline int toChunkCoord(float w) noexcept
{
    return static_cast<int>(std::floor(w / static_cast<float>(Chunk::SIZE)));
}

// Path to the world directory used for serialization.
// Versioned to prevent loading stale chunk data after generation changes.
const std::filesystem::path kWorldDir =
    std::filesystem::path{"world"} / TerrainConstants::kCacheVersion;

} // anonymous namespace

void World::init(std::function<void(uint32_t, uint32_t)> progress)
{
    // compute initial origin based on static camera start constants
    m_originX = static_cast<int32_t>(CAM_START_CX) - static_cast<int32_t>(RADIUS);
    m_originY = static_cast<int32_t>(CAM_START_CY) - static_cast<int32_t>(SIZE_Y - 1);
    m_originZ = static_cast<int32_t>(CAM_START_CZ) - static_cast<int32_t>(RADIUS);
    m_lastCamChunkX = CAM_START_CX;
    m_lastCamChunkY = CAM_START_CY;
    m_lastCamChunkZ = CAM_START_CZ;

    // ensure serialization directory exists
    std::filesystem::create_directories(kWorldDir);

    constexpr uint32_t total = SIZE * SIZE_Y * SIZE;
    uint32_t loaded = 0;

    // fill initial window, loading from disk if possible
    for (uint32_t cz = 0; cz < SIZE; ++cz)
        for (uint32_t cy = 0; cy < SIZE_Y; ++cy)
            for (uint32_t cx = 0; cx < SIZE; ++cx) {
                int32_t wx = m_originX + static_cast<int32_t>(cx);
                int32_t wy = m_originY + static_cast<int32_t>(cy);
                int32_t wz = m_originZ + static_cast<int32_t>(cz);
                std::unique_ptr<Chunk> chunk =
                    Chunk::loadFromDirectory(kWorldDir, wx, wy, wz);
                if (!chunk) {
                    chunk = std::make_unique<Chunk>(wx, wy, wz);
                    chunk->fill();
                }
                m_chunks[idx(cx, cy, cz)] = std::move(chunk);
                ++loaded;
                if (progress && (loaded % 50 == 0 || loaded == total))
                    progress(loaded, total);
            }
}


World::ShiftResult World::update(float camX, float camY, float camZ)
{
    const int newCamCX = toChunkCoord(camX);
    const int newCamCY = toChunkCoord(camY);
    const int newCamCZ = toChunkCoord(camZ);

    if (newCamCX == m_lastCamChunkX &&
        newCamCY == m_lastCamChunkY &&
        newCamCZ == m_lastCamChunkZ)
        return {};

    int32_t newOriginX = newCamCX - static_cast<int32_t>(RADIUS);
    int32_t newOriginY = newCamCY - static_cast<int32_t>(SIZE_Y - 1);
    int32_t newOriginZ = newCamCZ - static_cast<int32_t>(RADIUS);

    bool originMoved = (newOriginX != m_originX ||
                        newOriginY != m_originY ||
                        newOriginZ != m_originZ);

    m_lastCamChunkX = newCamCX;
    m_lastCamChunkY = newCamCY;
    m_lastCamChunkZ = newCamCZ;

    if (!originMoved)
        return {};

    // --- Pointer shuffle (main thread, fast — no I/O) ---
    std::unique_ptr<Chunk> oldChunks[SIZE * SIZE_Y * SIZE];
    bool reused[SIZE * SIZE_Y * SIZE] = {};

    for (uint32_t i = 0; i < SIZE * SIZE_Y * SIZE; ++i)
        oldChunks[i] = std::move(m_chunks[i]);

    ShiftResult result;
    result.moved = true;

    for (uint32_t cz = 0; cz < SIZE; ++cz) {
        for (uint32_t cy = 0; cy < SIZE_Y; ++cy) {
            for (uint32_t cx = 0; cx < SIZE; ++cx) {
                int32_t wx = newOriginX + static_cast<int32_t>(cx);
                int32_t wy = newOriginY + static_cast<int32_t>(cy);
                int32_t wz = newOriginZ + static_cast<int32_t>(cz);
                uint32_t newSlot = localIdx(cx, cy, cz);

                int32_t relX = wx - m_originX;
                int32_t relY = wy - m_originY;
                int32_t relZ = wz - m_originZ;
                if (relX >= 0 && relX < static_cast<int32_t>(SIZE) &&
                    relY >= 0 && relY < static_cast<int32_t>(SIZE_Y) &&
                    relZ >= 0 && relZ < static_cast<int32_t>(SIZE))
                {
                    uint32_t oldI = idx(static_cast<uint32_t>(relX),
                                        static_cast<uint32_t>(relY),
                                        static_cast<uint32_t>(relZ));
                    if (oldChunks[oldI]) {
                        m_chunks[newSlot] = std::move(oldChunks[oldI]);
                        reused[oldI] = true;
                        result.meshMoves.push_back({ oldI, newSlot });
                        continue;
                    }
                }
                m_chunks[newSlot] = nullptr;
                result.clearedSlots.push_back(newSlot);
            }
        }
    }

    m_originX = newOriginX;
    m_originY = newOriginY;
    m_originZ = newOriginZ;

    // --- Dispatch I/O and generation to background threads ---
    World* self = this;
    dispatch_queue_t bg = dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);

    for (uint32_t slot : result.clearedSlots) {
        uint32_t cx = slot % SIZE;
        uint32_t cy = (slot / SIZE) % SIZE_Y;
        uint32_t cz = slot / (SIZE * SIZE_Y);
        int32_t wx = newOriginX + static_cast<int32_t>(cx);
        int32_t wy = newOriginY + static_cast<int32_t>(cy);
        int32_t wz = newOriginZ + static_cast<int32_t>(cz);

        dispatch_async(bg, ^{
            std::unique_ptr<Chunk> chunk =
                Chunk::loadFromDirectory(kWorldDir, wx, wy, wz);
            if (!chunk) {
                chunk = std::make_unique<Chunk>(wx, wy, wz);
                chunk->fill();
            }
            std::lock_guard<std::mutex> lock(self->m_readyMutex);
            self->m_ready.push_back({ wx, wy, wz, std::move(chunk) });
        });
    }

    for (uint32_t i = 0; i < SIZE * SIZE_Y * SIZE; ++i) {
        if (!oldChunks[i] || reused[i]) continue;
        std::shared_ptr<Chunk> toSave(std::move(oldChunks[i]));
        dispatch_async(bg, ^{ toSave->saveToDirectory(kWorldDir); });
    }

    return result;
}

std::vector<uint32_t> World::flushReadyChunks()
{
    std::vector<ReadyChunk> batch;
    {
        std::lock_guard<std::mutex> lock(m_readyMutex);
        if (m_ready.empty()) return {};
        batch = std::move(m_ready);
    }

    std::vector<uint32_t> changed;
    for (auto& rc : batch) {
        // Validate: chunk must still be within the current window.
        int32_t lx = rc.wx - m_originX;
        int32_t ly = rc.wy - m_originY;
        int32_t lz = rc.wz - m_originZ;
        if (lx < 0 || lx >= static_cast<int32_t>(SIZE) ||
            ly < 0 || ly >= static_cast<int32_t>(SIZE_Y) ||
            lz < 0 || lz >= static_cast<int32_t>(SIZE))
            continue;  // window moved since this chunk was dispatched — discard
        uint32_t slot = idx(static_cast<uint32_t>(lx),
                            static_cast<uint32_t>(ly),
                            static_cast<uint32_t>(lz));
        m_chunks[slot] = std::move(rc.chunk);
        changed.push_back(slot);
    }
    return changed;
}

// Compute floor division (rounds toward -infinity) for a positive divisor.
static constexpr int floorDiv(int a, int b) noexcept
{
    return a / b - (a % b != 0 && a < 0 ? 1 : 0);
}

float World::densityAt(int wx, int wy, int wz) const noexcept
{
    constexpr int S = static_cast<int>(Chunk::SIZE);
    const int cx = floorDiv(wx, S);
    const int cy = floorDiv(wy, S);
    const int cz = floorDiv(wz, S);
    const int lx = wx - cx * S;
    const int ly = wy - cy * S;
    const int lz = wz - cz * S;
    const Chunk* chunk = chunkAt(cx - m_originX, cy - m_originY, cz - m_originZ);
    if (!chunk) return 0.0f;
    return chunk->at(
        static_cast<uint32_t>(lx),
        static_cast<uint32_t>(ly),
        static_cast<uint32_t>(lz)).getValue();
}

bool World::isSolidAt(int wx, int wy, int wz) const noexcept
{
    constexpr int S = static_cast<int>(Chunk::SIZE);
    const int cx = floorDiv(wx, S);
    const int cy = floorDiv(wy, S);
    const int cz = floorDiv(wz, S);
    const int lx = wx - cx * S;
    const int ly = wy - cy * S;
    const int lz = wz - cz * S;
    const Chunk* chunk = chunkAt(cx - m_originX, cy - m_originY, cz - m_originZ);
    if (!chunk) return false;
    return chunk->at(
        static_cast<uint32_t>(lx),
        static_cast<uint32_t>(ly),
        static_cast<uint32_t>(lz)).getValue() >= 0.5f;
}

const Chunk* World::chunkAt(int cx, int cy, int cz) const noexcept
{
    if (cx < 0 || cy < 0 || cz < 0) return nullptr;
    const uint32_t ucx = static_cast<uint32_t>(cx);
    const uint32_t ucy = static_cast<uint32_t>(cy);
    const uint32_t ucz = static_cast<uint32_t>(cz);
    if (ucx >= SIZE || ucy >= SIZE_Y || ucz >= SIZE) return nullptr;
    return m_chunks[idx(ucx, ucy, ucz)].get();
}
