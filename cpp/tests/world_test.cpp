#include <cppunit/extensions/HelperMacros.h>
#include <filesystem>
#include "../lib/world/world.hpp"
#include "../lib/chunk/chunk.hpp"

class WorldTest : public CppUnit::TestFixture {
    CPPUNIT_TEST_SUITE(WorldTest);
    CPPUNIT_TEST(testInitialOriginAndChunk);
    CPPUNIT_TEST(testUpdateUnloadsAndReloads);
    CPPUNIT_TEST_SUITE_END();

public:
    void setUp() override
    {
        std::filesystem::remove_all("world");
        World::destroy();
    }

    void tearDown() override
    {
        std::filesystem::remove_all("world");
        World::destroy();
    }

    void testInitialOriginAndChunk()
    {
        World& w = World::instance();
        w.init();
        // the chunk at grid 0,0,0 should exist and have sensible coordinates
        const Chunk* c = w.chunkAt(0,0,0);
        CPPUNIT_ASSERT(c != nullptr);
        int32_t expectedX = World::CAM_START_CX - World::RADIUS;
        int32_t expectedY = World::CAM_START_CY - World::RADIUS;
        int32_t expectedZ = World::CAM_START_CZ - World::RADIUS;
        CPPUNIT_ASSERT_EQUAL(expectedX, c->gridX());
        CPPUNIT_ASSERT_EQUAL(expectedY, c->gridY());
        CPPUNIT_ASSERT_EQUAL(expectedZ, c->gridZ());
    }

    void testUpdateUnloadsAndReloads()
    {
        World& w = World::instance();
        w.init();
        // modify a corner of the chunk that lives at the origin of the window
        Chunk* orig = const_cast<Chunk*>(w.chunkAt(0,0,0));
        CPPUNIT_ASSERT(orig);
        orig->at(0,0,0).setValue(0.42f);

        // move camera one chunk along +X, forcing that origin chunk to unload
        float camX = (World::CAM_START_CX + 1.5f) * Chunk::SIZE; // cross boundary
        float camY = (World::CAM_START_CY + 0.5f) * Chunk::SIZE;
        float camZ = (World::CAM_START_CZ + 0.5f) * Chunk::SIZE;
        bool changed = w.update(camX, camY, camZ);
        CPPUNIT_ASSERT(changed);

        // file for the original chunk should exist now
        int32_t oldWx = World::CAM_START_CX - World::RADIUS;
        int32_t oldWy = World::CAM_START_CY - World::RADIUS;
        int32_t oldWz = World::CAM_START_CZ - World::RADIUS;
        std::filesystem::path p = std::filesystem::path("world") /
            (std::to_string(oldWx) + "_" +
             std::to_string(oldWy) + "_" +
             std::to_string(oldWz) + "_chunk");
        CPPUNIT_ASSERT(std::filesystem::exists(p));

        // move camera back to original position; chunk should reload from file
        camX = (World::CAM_START_CX + 0.5f) * Chunk::SIZE;
        camY = (World::CAM_START_CY + 0.5f) * Chunk::SIZE;
        camZ = (World::CAM_START_CZ + 0.5f) * Chunk::SIZE;
        changed = w.update(camX, camY, camZ);
        CPPUNIT_ASSERT(changed);

        const Chunk* reloaded = w.chunkAt(0,0,0);
        CPPUNIT_ASSERT(reloaded);
        CPPUNIT_ASSERT_DOUBLES_EQUAL(0.42f, reloaded->at(0,0,0).getValue(), 1e-6f);
    }
};

CPPUNIT_TEST_SUITE_REGISTRATION(WorldTest);
