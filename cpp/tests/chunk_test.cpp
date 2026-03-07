#include <cppunit/extensions/HelperMacros.h>
#include "../lib/chunk/chunk.hpp"
#include "../lib/corner/corner.hpp"
#include <filesystem>

class ChunkTest : public CppUnit::TestFixture {
    CPPUNIT_TEST_SUITE(ChunkTest);
    CPPUNIT_TEST(testGridCoordinates);
    CPPUNIT_TEST(testFillUsesCoordinates);
    CPPUNIT_TEST(testSerializationRoundtrip);
    CPPUNIT_TEST_SUITE_END();

public:
    void testGridCoordinates()
    {
        Chunk c;
        CPPUNIT_ASSERT_EQUAL(0, c.gridX());
        CPPUNIT_ASSERT_EQUAL(0, c.gridY());
        CPPUNIT_ASSERT_EQUAL(0, c.gridZ());
        c.setGridCoordinate(1, 2, 3);
        CPPUNIT_ASSERT_EQUAL(1, c.gridX());
        CPPUNIT_ASSERT_EQUAL(2, c.gridY());
        CPPUNIT_ASSERT_EQUAL(3, c.gridZ());
    }

    void testFillUsesCoordinates()
    {
        Chunk c(5, 6, 7);
        c.fill();
        const Corner* data = c.data();
        CPPUNIT_ASSERT(data != nullptr);
        // the plane fill should give some non-zero density at the first corner
        CPPUNIT_ASSERT(data[0].getValue() != 0.0f);
    }

    void testSerializationRoundtrip()
    {
        namespace fs = std::filesystem;
        fs::path tmp = fs::path("test_world");
        fs::remove_all(tmp);
        fs::create_directories(tmp);

        // make a chunk, modify a value, save and reload
        Chunk original(1, 2, 3);
        original.fill();
        original.at(0,0,0).setValue(0.75f);  // force known change

        CPPUNIT_ASSERT(original.saveToDirectory(tmp));

        auto loaded = Chunk::loadFromDirectory(tmp, 1, 2, 3);
        CPPUNIT_ASSERT(loaded != nullptr);
        CPPUNIT_ASSERT_DOUBLES_EQUAL(0.75f, loaded->at(0,0,0).getValue(), 1e-6f);

        // cleanup
        fs::remove_all(tmp);
    }
};

CPPUNIT_TEST_SUITE_REGISTRATION(ChunkTest);
