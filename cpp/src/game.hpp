#pragma once
#include <cstdint>
#include <functional>
#include <memory>
#include "renderer/IRenderer.h"
#include "renderer/IBuffer.h"
#include "renderer/ICommandBuffer.h"
#include "camera/camera.hpp"
#include "world/worldRenderer.hpp"
#include "math/mat4.hpp"

/// Platform-agnostic game state: camera, physics, world streaming, and rendering.
///
/// The platform layer (main.mm on macOS, or any future backend) owns IRenderer
/// and drives the frame loop. Game owns everything that does not depend on a
/// specific OS or graphics API, making it straightforward to reuse across
/// Metal, DirectX, Vulkan, or headless test environments.
class Game {
public:
    Game() = default;

    /// Called once after the renderer is ready and the viewport size is known.
    void init(IRenderer& renderer, uint32_t width, uint32_t height);

    /// Synchronous world + mesh loading — designed to be called from a background thread.
    /// worldProgress(done, total) fires during chunk generation.
    /// meshProgress(done, total) fires during GPU mesh building.
    /// Both callbacks are invoked on the calling thread; the platform layer is
    /// responsible for marshalling them to a UI thread if needed.
    using ProgressFn = std::function<void(uint32_t done, uint32_t total)>;
    void loadWorld(ProgressFn worldProgress, ProgressFn meshProgress);

    /// Advance game state by dt seconds (camera, physics, world streaming, MVP).
    void update(float dt);

    /// Issue draw calls for the current frame into cmd.
    void render(ICommandBuffer& cmd);

    /// Notify Game of a viewport resize (updates camera aspect ratio and MVP).
    void resize(uint32_t width, uint32_t height);

    /// Forward a raw key-down event (macOS virtual key code).
    /// kQuit is handled by the platform layer and must not be forwarded here.
    void keyDown(uint16_t code);

    /// Forward a raw key-up event.
    void keyUp(uint16_t code);

    /// Forward raw mouse deltas from a mouseMoved event.
    /// dx > 0 = mouse right, dy > 0 = mouse down (NSEvent delta convention).
    void mouseDelta(float dx, float dy);

private:
    void rebuildMVP();

    IRenderer*               m_renderer  = nullptr; ///< non-owning — lifetime managed by platform
    Camera                   m_camera;
    WorldRenderer            m_worldRenderer;
    std::unique_ptr<IBuffer> m_uniformBuf;
    uint32_t                 m_width     = 0;
    uint32_t                 m_height    = 0;
    float                    m_velY      = 0.0f;
    bool                     m_grounded  = false;
};
