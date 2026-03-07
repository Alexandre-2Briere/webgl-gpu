CXX      := clang++
CXXFLAGS := -std=c++17 -Wall -Wextra -O0 -Iinclude -Ilib -fobjc-arc

BUILD_DIR := build

# --- Shared game source ---
GAME_SRC := src/game.cpp

# --- Metal (macOS) ---
METAL_SRC     := src/main.mm $(GAME_SRC)
METAL_LIB     := $(shell find lib \( -name '*.cpp' -o -name '*.mm' \) ! -path '*/renderer/directx/*' 2>/dev/null)
METAL_LDFLAGS := -framework Metal \
                 -framework Foundation \
                 -framework QuartzCore \
                 -framework Cocoa
METAL_BIN     := $(BUILD_DIR)/app_metal

# --- DirectX 11 (Windows — run make directx on Windows with MSVC installed) ---
DX_CXX        := cl.exe
DX_CXXFLAGS   := /std:c++17 /W3 /O0 /Iinclude /Ilib /EHsc /D_WIN32
DX_SRC        := src/main_dx.cpp $(GAME_SRC)
DX_LIB        := $(shell find lib -name '*.cpp' ! -path '*/renderer/metal/*' 2>/dev/null)
DX_LDFLAGS    := d3d11.lib d3dcompiler.lib dxgi.lib user32.lib gdi32.lib
DX_BIN        := $(BUILD_DIR)/app_dx.exe

# --- Tests ---
CPPUNIT_CFLAGS := $(shell pkg-config --cflags cppunit 2>/dev/null)
CPPUNIT_LIBS   := $(shell pkg-config --libs   cppunit 2>/dev/null || echo "-lcppunit")
GAME_LIBS      := $(shell find lib -name '*.cpp' ! -path '*/renderer/*' 2>/dev/null)
TEST_FILES     := $(shell find tests -name '*.cpp' 2>/dev/null)
TEST_BIN       := $(BUILD_DIR)/test_runner

.PHONY: metal directx test doc clean

metal: $(METAL_BIN)

$(METAL_BIN): $(METAL_SRC) $(METAL_LIB) | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(METAL_LDFLAGS)

directx: $(DX_BIN)

$(DX_BIN): $(DX_SRC) $(DX_LIB) | $(BUILD_DIR)
	$(DX_CXX) $(DX_CXXFLAGS) $^ /Fe:$@ /link $(DX_LDFLAGS)

test: $(TEST_BIN)
	./$(TEST_BIN)

$(TEST_BIN): $(TEST_FILES) $(GAME_LIBS) | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $(CPPUNIT_CFLAGS) $^ -o $@ $(CPPUNIT_LIBS)

doc:
	doxygen doc/Doxyfile

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

clean:
	rm -rf $(BUILD_DIR)
