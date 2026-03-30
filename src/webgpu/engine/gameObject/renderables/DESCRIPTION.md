# Renderables

## Role

The GPU-side visual representations of game objects. Each renderable owns (or shares) vertex/index buffers and a uniform slot, and knows how to encode a draw call into a render pass encoder. The `Renderable` base interface defines the contract; concrete classes implement specific geometry types.

## Key Concepts

- **Renderable (interface)**: Defines `layer` (`'world'` or `'overlay'`), `visible`, `pipelineKey`, and `encode(passEncoder)`. The Scene iterates this interface — it never casts to a specific type.
- **Mesh**: Static indexed or non-indexed geometry. Owns a `VertexBuffer` and optional index buffer. Supports runtime vertex updates and a per-object tint uniform.
- **ComputedRenderable**: GPU-computed geometry (marching cubes). Owns a `StorageBuffer` (voxel data), an `IndirectBuffer` (draw args), and a `ComputePass`. Registered in both the compute list and the world list in Scene.
- **Quad2D**: Screen-space colored quad. Vertex data is in NDC. Always on top (depth = 0). No camera transform applied in the shader.
- **Quad3D**: World-space colored quad. Depth-tested. No lighting. Both sides visible (no back-face culling).
- **Model3D / FbxModel**: Instances of loaded assets. Vertex/index buffers are shared via `ModelAssetHandle` / `FbxAssetHandle`. Each instance owns only its per-object uniform slot.

## Invariants

- Every renderable holds a `UniformSlot` for its per-object uniform (model matrix + tint). This slot is allocated from `UniformPool` at construction and is never reallocated.
- `visible = false` skips `encode()` but does not free GPU resources. The uniform slot and buffers remain allocated.
- The 48-byte vertex layout (position, pad, normal, pad, color) is shared by `Mesh`, `ComputedRenderable`, `Quad3D`, and `Model3D`. `FbxModel` uses a different 64-byte layout.
- `pipelineKey` is a stable string that identifies which GPU pipeline to use. The Scene sorts world renderables by this key to batch draw calls by pipeline.
- `Model3D` and `FbxModel` share buffers with their asset handle. Destroying the asset handle while instances still reference it is a use-after-free bug.
- `ComputedRenderable` participates in two lists in Scene: it must be encoded in the compute pre-pass (to generate geometry) AND in the world pass (to draw the generated geometry).

## Edge Cases

- **Asset destroyed before instance**: If `ModelAssetHandle.destroy()` is called before all `Model3D` instances are destroyed, those instances hold dangling buffer references. Subsequent draw calls will access freed GPU memory.
- **Vertex update larger than allocated buffer**: `setVertices()` writes new data to an existing fixed-size `VertexBuffer`. If the new data is larger than the buffer, the write is silently truncated or causes undefined behavior. The buffer size is fixed at creation.
- **Index buffer update to different count**: Similarly, `setIndices()` writes to a fixed-size buffer. Changing from 6 indices to 12 on a buffer sized for 6 will corrupt adjacent GPU memory.
- **ComputedRenderable visibility**: Setting `visible = false` on a `ComputedRenderable` skips both the compute dispatch and the draw call. The output buffer retains its previous contents. If `visible` is toggled back to `true`, the geometry from the previous visible frame is drawn until the compute shader runs again.
- **Quad2D outside NDC bounds**: NDC coordinates outside `[-1, 1]` are clipped by the GPU. No engine-side validation exists. The quad silently disappears or is partially clipped.
- **Model3D shared uniform slots**: Multiple `Model3D` instances each have their own uniform slot. They share vertex/index buffers only. One instance's `setTint()` does not affect others.
- **FbxModel missing texture**: If a texture failed to load, the material uses a default fallback. The object renders but may appear incorrect (solid color or missing normal map).

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| Asset destroyed before instance | Silent — GPU use-after-free |
| `setVertices()` with larger data than buffer | Silent — truncated or GPU UB |
| `setIndices()` with mismatched count | Silent — GPU UB |
| ComputedRenderable visibility toggled | One-frame stale geometry on re-enable |
| Quad2D outside NDC | Silent — clipped by GPU |
| Missing FBX texture | Silent — fallback material |

## Test Scenarios

- **Mesh visibility**: create mesh, set `visible = false`, verify `encode()` is not called; set `visible = true`, verify it is called again.
- **Mesh vertex update**: create with 3-vertex buffer, call `setVertices()` with 3 new vertices — verify data is uploaded.
- **Mesh vertex update overflow**: call `setVertices()` with more vertices than the buffer holds — document the behavior (truncation or throw).
- **Mesh tint**: call `setTint(0.5, 0.5, 0.5, 1)` — verify the uniform slot contains the expected tint value.
- **Model3D isolation**: create two instances from the same asset, call `setTint` on one — verify the other is unaffected.
- **Asset lifecycle**: `loadModel()` → create two `Model3D` → `asset.destroy()` → `model.encode()` — document whether this throws or silently corrupts.
- **ComputedRenderable both lists**: add to Scene — verify it appears in `_computedRenderables` and `_worldRenderables`.
- **Quad2D NDC bounds**: create at `x=1.0, y=1.0, width=0, height=0` — verify no throw.
- **pipelineKey sort**: add renderables with unsorted keys — verify Scene world list is in ascending key order.
- **destroy then use**: call `mesh.destroy()` then `mesh.setModelMatrix()` — document whether it throws.
