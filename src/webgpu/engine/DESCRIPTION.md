# Engine (Root)

## Role

The root module is the single entry point for the entire engine. It exposes a facade API that hides all internal subsystems — GPU initialization, scene management, pipeline caching, physics, rendering — behind one `Engine` class and a set of typed handles. Consumers never interact with internal classes directly.

## Key Concepts

- **Async factory**: `Engine.create()` is the only way to instantiate the engine. It requests a GPU adapter, creates the device, and wires up all subsystems. It will throw if WebGPU is unavailable.
- **Handles**: Every created object (mesh, camera, model…) returns an opaque handle. The handle owns the GPU resources and is the only way to mutate or destroy that object.
- **Active camera**: Exactly one camera is active at a time. The engine will not render without one. Switching cameras with `setCamera()` takes effect on the next frame.
- **Render loop**: `start()` begins a `requestAnimationFrame` loop. `stop()` cancels it. The loop is not running on creation — the caller must start it explicitly.
- **Physics integration**: `applyPhysics` and `applyCollisions` are called once per frame as part of the loop when `GameObjects` are registered. Physics runs before rendering.

## Invariants

- `Engine.create()` must resolve before any other method is called.
- A camera must be set via `setCamera()` before the first frame is rendered.
- Each handle is valid only for the lifetime of its owning engine instance.
- `start()` should not be called more than once without an intervening `stop()`.

## Edge Cases

- Calling `start()` a second time without `stop()` would create a second RAF loop — double-ticking the physics and render pipeline.
- Destroying a handle (e.g. `mesh.destroy()`) while the render loop is mid-frame may cause a draw call against a destroyed buffer. Destruction should happen outside the frame callback, or be deferred.
- `engine.camera` accessed before `setCamera()` is called will return `undefined` / throw depending on the implementation.
- Calling `stop()` when the loop is not running is a no-op and should not throw.
- `Engine.create()` on a browser that lacks WebGPU support will reject the promise; the caller must handle this.
- Creating many handles and never calling `destroy()` will exhaust the `UniformPool` (512-object cap).

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| WebGPU not supported | Loud — `create()` rejects |
| No camera set before render | Likely a GPU validation error or silent black frame |
| `start()` called twice | Silent — duplicate RAF, double physics ticks |
| UniformPool exhausted | Loud — throws on the 513th object created |
| Handle used after `destroy()` | Silent GPU UB or validation layer warning |

## Test Scenarios

- **Happy path**: create engine, set camera, create mesh, call `start()`, verify loop runs.
- **No camera**: call `start()` with no camera set — expect graceful error or clear assertion.
- **Double start**: call `start()` twice — verify RAF is not duplicated (hook into `requestAnimationFrame`).
- **Stop/start cycle**: `start()` → `stop()` → `start()` — verify loop resumes cleanly.
- **Handle after destroy**: call `mesh.destroy()` then `mesh.setTint()` — expect throw or no-op, not silent corruption.
- **UniformPool exhaustion**: create 513 meshes — expect the 513th to throw.
- **Camera switch mid-loop**: switch camera between frames — verify next frame uses new camera matrices.
- **Multiple engine instances**: create two engines on different canvases — verify they don't share state.
