#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdint>

#include "renderer/RendererFactory.h"
#include "renderer/IRenderer.h"
#include "renderer/ICommandBuffer.h"
#include "constants/controls.hpp"
#include "game.hpp"

// ---------------------------------------------------------------------------
// Key-code translation: Windows VK_* → macOS virtual key codes used by Controls.
// ---------------------------------------------------------------------------
static uint16_t vkToMacCode(WPARAM vk)
{
    switch (vk) {
        case 'A':        return Controls::kMoveLeft;
        case 'D':        return Controls::kMoveRight;
        case 'W':        return Controls::kMoveForward;
        case 'S':        return Controls::kMoveBackward;
        case VK_SPACE:   return Controls::kJump;
        case VK_UP:      return Controls::kCameraUp;
        case VK_DOWN:    return Controls::kCameraDown;
        case VK_LEFT:    return Controls::kCameraLeft;
        case VK_RIGHT:   return Controls::kCameraRight;
        case 'C':        return Controls::kDig;
        case 'B':        return Controls::kFill;
        default:         return static_cast<uint16_t>(0xFFFF);  // unmapped
    }
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------
struct AppState {
    std::unique_ptr<IRenderer> renderer;
    Game                       game;
    bool                       running       = true;
    bool                       cursorLocked  = false;
    HWND                       hwnd          = nullptr;
    LARGE_INTEGER              lastTime      = {};
    LARGE_INTEGER              perfFreq      = {};
    uint32_t                   width         = 0;
    uint32_t                   height        = 0;
};

static AppState* gApp = nullptr;

static void lockCursor(AppState* app)
{
    if (app->cursorLocked) return;
    app->cursorLocked = true;
    ShowCursor(FALSE);
    RECT rc;
    GetClientRect(app->hwnd, &rc);
    MapWindowRect(app->hwnd, nullptr, &rc);
    ClipCursor(&rc);
}

static void unlockCursor(AppState* app)
{
    if (!app->cursorLocked) return;
    app->cursorLocked = false;
    ShowCursor(TRUE);
    ClipCursor(nullptr);
}

// ---------------------------------------------------------------------------
// Window procedure
// ---------------------------------------------------------------------------
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp)
{
    AppState* app = gApp;

    switch (msg) {
        case WM_DESTROY:
            if (app) { unlockCursor(app); app->running = false; }
            PostQuitMessage(0);
            return 0;

        case WM_KEYDOWN:
            if (!app) break;
            if (wp == VK_ESCAPE) {
                unlockCursor(app);
                app->running = false;
                DestroyWindow(hwnd);
                return 0;
            }
            {
                uint16_t code = vkToMacCode(wp);
                if (code != 0xFFFF) app->game.keyDown(code);
            }
            return 0;

        case WM_KEYUP:
            if (!app) break;
            {
                uint16_t code = vkToMacCode(wp);
                if (code != 0xFFFF) app->game.keyUp(code);
            }
            return 0;

        case WM_LBUTTONDOWN:
            if (app) lockCursor(app);
            return 0;

        case WM_INPUT: {
            if (!app || !app->cursorLocked) break;
            UINT size = 0;
            GetRawInputData(reinterpret_cast<HRAWINPUT>(lp),
                            RID_INPUT, nullptr, &size, sizeof(RAWINPUTHEADER));
            if (size == 0) break;
            RAWINPUT* raw = static_cast<RAWINPUT*>(_alloca(size));
            if (GetRawInputData(reinterpret_cast<HRAWINPUT>(lp),
                                RID_INPUT, raw, &size, sizeof(RAWINPUTHEADER)) != size)
                break;
            if (raw->header.dwType == RIM_TYPEMOUSE) {
                float dx = static_cast<float>(raw->data.mouse.lLastX);
                float dy = static_cast<float>(raw->data.mouse.lLastY);
                app->game.mouseDelta(dx, dy);
            }
            break;
        }

        case WM_SIZE:
            if (app && app->renderer) {
                uint32_t w = LOWORD(lp);
                uint32_t h = HIWORD(lp);
                if (w > 0 && h > 0) {
                    app->width  = w;
                    app->height = h;
                    app->renderer->resize(w, h);
                    app->game.resize(w, h);
                }
            }
            return 0;

        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int)
{
    AppState app;
    gApp = &app;

    // --- Query performance frequency for delta-time ---
    QueryPerformanceFrequency(&app.perfFreq);
    QueryPerformanceCounter(&app.lastTime);

    // --- Determine monitor size for fullscreen window ---
    app.width  = static_cast<uint32_t>(GetSystemMetrics(SM_CXSCREEN));
    app.height = static_cast<uint32_t>(GetSystemMetrics(SM_CYSCREEN));

    // --- Register window class ---
    WNDCLASSEXW wc  = {};
    wc.cbSize        = sizeof(wc);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursorW(nullptr, IDC_ARROW);
    wc.lpszClassName = L"WebGLDemoClass";
    RegisterClassExW(&wc);

    // --- Create borderless fullscreen window ---
    app.hwnd = CreateWindowExW(
        0, L"WebGLDemoClass", L"WebGL Demo (DirectX 11)",
        WS_POPUP | WS_VISIBLE,
        0, 0, static_cast<int>(app.width), static_cast<int>(app.height),
        nullptr, nullptr, hInstance, nullptr);

    if (!app.hwnd) return 1;

    // --- Register raw mouse input ---
    RAWINPUTDEVICE rid = {};
    rid.usUsagePage = 0x01;  // HID_USAGE_PAGE_GENERIC
    rid.usUsage     = 0x02;  // HID_USAGE_GENERIC_MOUSE
    rid.dwFlags     = RIDEV_INPUTSINK;
    rid.hwndTarget  = app.hwnd;
    RegisterRawInputDevices(&rid, 1, sizeof(rid));

    // --- Renderer ---
    app.renderer = RendererFactory::create(RendererBackend::DirectX11);
    if (!app.renderer->init(app.hwnd, app.width, app.height)) return 1;

    // --- Game init and world load (synchronous — no loading overlay) ---
    app.game.init(*app.renderer, app.width, app.height);
    app.game.loadWorld(nullptr, nullptr);

    // --- Frame loop ---
    while (app.running) {
        MSG msg = {};
        while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) { app.running = false; break; }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        if (!app.running) break;

        LARGE_INTEGER now;
        QueryPerformanceCounter(&now);
        float dt = static_cast<float>(now.QuadPart - app.lastTime.QuadPart)
                   / static_cast<float>(app.perfFreq.QuadPart);
        app.lastTime = now;
        if (dt > 0.1f) dt = 0.1f;  // cap: avoid spiral-of-death after stall

        app.game.update(dt);

        ICommandBuffer* cmd = app.renderer->beginFrame();
        if (cmd) {
            app.game.render(*cmd);
            app.renderer->endFrame();
            app.renderer->present();
        }
    }

    gApp = nullptr;
    return 0;
}
