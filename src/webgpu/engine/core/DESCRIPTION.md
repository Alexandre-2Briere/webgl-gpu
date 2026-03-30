# Core

## Role

The foundational rendering subsystem. Contains the four classes that together make every frame happen: `Camera` (view/projection math + GPU uniform), `Renderer` (WebGPU device plumbing + surface management), `Scene` (renderable registry + frame orchestration), and `PipelineCache` (deduplicates GPU pipeline creation).

## Key Concepts

- **Camera**: Converts position + yaw/pitch into a view matrix and a projection matrix. Uploads a 144-byte uniform block (viewProj, view, world position) to the GPU each frame. Pitch is clamped to ±89° to prevent gimbal lock.
- **Renderer**: Holds the `GPUDevice`, `GPUQueue`, swap chain context, and depth texture. Provides color and depth attachment views for each frame. Manages canvas resizing via `ResizeObserver`.
- **Scene**: Maintains three ordered lists of renderables — world, overlay, computed. Orchestrates the three-pass frame: compute pre-pass → world pass → overlay pass.
- **PipelineCache**: A `Map<string, GPUPipeline>` keyed by a caller-supplied string. Prevents duplicate pipeline creation across frames. Never invalidated.

## Invariants

- Camera matrices are **column-major** (`Float32Array`, WebGPU standard).
- `updateMatrices(aspectRatio)` must be called before `uploadTo(queue)` each frame. Uploading stale matrices produces a skewed or incorrect view.
- Yaw/pitch are stored and clamped independently. Pitch never exceeds ±89° (≈ ±1.5533 radians).
- World renderables are sorted by `pipelineKey` (string comparison) after every `add()` call, to minimize `setPipeline` calls during the world pass.
- A `ComputedRenderable` is added to both the `_computedRenderables` list and the `_worldRenderables` list. Removing it removes it from both.
- The depth texture is always recreated on canvas resize. Any view obtained before the resize becomes stale after it.
- `PipelineCache` keys must be globally unique per pipeline configuration. There is no automatic invalidation.

## Edge Cases

- **Aspect ratio of 0**: Passing `aspectRatio = 0` to `updateMatrices()` will produce a degenerate projection matrix (division by zero in the projection formula). Caller must guard against zero-sized canvases.
- **Resize during frame**: `ResizeObserver` fires asynchronously. If a resize fires mid-frame, the old depth texture view may be used for the current frame and the new one for the next. This is one-frame artifact, not a corruption.
- **Pipeline key collision**: Two different pipeline configurations with the same string key will silently reuse the first pipeline. The second configuration is never created. This produces wrong rendering with no error.
- **Camera before `setCamera()`**: Accessing `engine.camera` before calling `setCamera()` returns `undefined`. Any method that calls `camera.uploadTo()` or `camera.bindGroup` will throw.
- **Scene with no renderables**: All three passes are still encoded but are trivially fast. The compute pass is skipped if `_computedRenderables` is empty.
- **Overlay pass skipped**: If no overlay renderables are visible, the overlay pass is skipped entirely (no encoder opened). This is correct behavior but means overlay pass state is never initialized that frame.
- **World pass clear color**: Hardcoded to `[0.1, 0.12, 0.15, 1]`. If a transparent background is needed, the clear color must be changed.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| `updateMatrices()` not called before `uploadTo()` | Silent — last valid matrices used |
| Aspect ratio = 0 | Silent — degenerate projection, likely NaN in GPU |
| Pipeline key collision | Silent — wrong pipeline used |
| Depth texture view used after resize | One-frame visual glitch |
| ComputedRenderable not removed from both lists | Silent — stale compute dispatched for invisible object |
| `setCamera()` never called | Loud — `camera.bindGroup` throws |

## Test Scenarios

- **Camera pitch clamping**: set pitch to 2.0 radians (> 89°) — verify it clamps to `89 * π/180`.
- **Camera matrices**: set known position/yaw/pitch, call `updateMatrices(1.0)`, verify `viewProj` equals the expected column-major matrix.
- **Camera upload timing**: call `uploadTo()` without `updateMatrices()` — verify stale data is used (not a crash).
- **Scene sort**: add three renderables with pipelineKeys `"c"`, `"a"`, `"b"` — verify world list is sorted `["a", "b", "c"]` after each add.
- **ComputedRenderable dual registration**: add a ComputedRenderable — verify it appears in both `_computedRenderables` and `_worldRenderables`. Remove it — verify it is gone from both.
- **PipelineCache hit**: call `getOrCreateRender` twice with the same key — verify the second call returns the same pipeline object.
- **PipelineCache key collision**: call `getOrCreateRender` twice with the same key but different descriptors — verify the first descriptor wins (cache hit on second call).
- **Resize handling**: simulate a resize event — verify depth texture is recreated at the new dimensions.
- **Zero-render frame**: call `scene.frame()` with no renderables registered — verify no GPU errors.
