# Shaders

## Role

WGSL shader source code and the TypeScript objects that describe how to build GPU pipelines from them. Each shader module is a `.wgsl` file paired with a `.ts` descriptor. The `.ts` files export the WGSL source as a string and the pipeline configuration, making it easy to construct `GPURenderPipeline` objects from the `PipelineCache`.

## Key Concepts

- **Bind group layout** (shared across all world shaders):
  - Group 0, Binding 0: camera uniforms (`CameraUniforms` — viewProj, view, position)
  - Group 1, Binding 0: object uniforms (`ObjectUniforms` — model matrix, tint)
  - Group 2 (FBX only): diffuse texture, normal map texture, sampler
- **Vertex layouts** (two formats):
  - Standard (48 bytes): position (vec3+pad), normal (vec3+pad), color (vec4)
  - FBX (64 bytes): position (vec3+pad), normal (vec3+pad), UV (vec2+pad+pad), tangent+handedness (vec3+f32)
- **Lighting model** (mesh shader): single hardcoded directional light at `normalize([1,1,1])`. Diffuse `= max(dot(N, L), 0)`. Final color `= vertex_color × tint × (0.3 + 0.7 × diffuse)`. Ambient is 0.3.
- **Overlay pass** (Quad2D): NDC passthrough — vertex positions are already in clip space. Depth is hardcoded to 0.0 so the quad always renders on top. Camera uniforms are declared but not used.
- **World pass without lighting** (Quad3D): world-space position transformed by viewProj. Depth-tested. No back-face culling. Flat color only.

## Invariants

- All world shaders bind camera at group 0. All object-level shaders bind object uniforms at group 1. This must match `bindGroupLayouts.ts` exactly or the GPU validation layer will reject the pipeline.
- Normal transformation uses `model * vec4(normal, 0.0)`. This is correct only for **uniform scale** (orthogonal rotation). Non-uniform scale requires the inverse-transpose of the model matrix for correct normals.
- Quad2D depth is always 0.0 — it renders over everything in the world pass, including objects at z=0.
- Quad3D has no back-face culling. Both sides of the quad are visible, but winding order still matters for consistent normals if lighting were added later.
- FBX shader uses tangent-space normal mapping. The tangent frame (T, B, N) is reconstructed per-fragment using the tangent and handedness from the vertex buffer.
- The mesh shader's light direction is a compile-time constant — `normalize([1,1,1])` which equals approximately `[0.577, 0.577, 0.577]`. There is no dynamic light source.

## Edge Cases

- **Non-uniform scale breaks normals**: A model scaled with `[2, 1, 1]` will shear the normals. The lighting will look incorrect on scaled objects. The fix (inverse-transpose) is not currently applied.
- **Quad2D with camera uniform declared but unused**: Group 0 is bound even for Quad2D (the engine binds it for all passes). The Quad2D shader declares the camera binding but reads nothing from it. This is safe but wastes a bind slot.
- **Quad3D behind opaque world geometry**: Depth testing is enabled. A Quad3D positioned behind a solid mesh will be occluded correctly. A Quad3D at the same depth as another surface may flicker (z-fighting) depending on depth precision.
- **FBX shader with missing normal map**: If the normal map texture binding is a 1×1 fallback texture, the tangent-space calculation still runs but the result is flat normals. The object renders with incorrect tangent-space lighting if the fallback is not a neutral normal map (`[0.5, 0.5, 1.0]` in sRGB).
- **Vertex color in OBJ meshes**: Always `[1, 1, 1, 1]` from the parser. The tint uniform multiplies it. The effective color is purely the tint.
- **Depth precision (24-bit)**: The depth buffer uses `'depth24plus'` format. At far distances (near/far ratio of 2000/0.1 = 20000:1), depth precision degrades and z-fighting becomes visible. This is a known limitation of linear depth with perspective projection.
- **Pipeline key uniqueness**: If two different shader configurations use the same `pipelineKey` string (e.g. two Mesh variants), the second will silently reuse the first pipeline's GPU object from `PipelineCache`.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| Non-uniform scale on mesh | Silent — incorrect lighting |
| Wrong bind group layout | GPU validation error |
| FBX fallback normal map not neutral | Silent — wrong tangent-space lighting |
| Two shaders with same pipeline key | Silent — wrong pipeline used for one |
| Z-fighting at far distances | Visual — flickering surfaces |
| Quad2D rendered over world pass content | Expected behavior (depth = 0) |

## Test Scenarios

- **Bind group layout match**: verify that the group/binding slots in each `.wgsl` file match the corresponding `createCameraLayout()` and `createObjectLayout()` definitions in `bindGroupLayouts.ts`.
- **Mesh lighting — front-facing**: a mesh with normal `[0,0,1]` (facing positive Z), light at `normalize([1,1,1])` — verify lit color = `vertex_color × tint × (0.3 + 0.7 × dot([0,0,1],[0.577,0.577,0.577]))`.
- **Mesh lighting — back-facing**: a mesh with normal `[0,0,-1]` — verify diffuse = 0, final color = `vertex_color × tint × 0.3`.
- **Mesh tint**: set object tint to `[1, 0, 0, 1]`, vertex color `[1, 1, 1, 1]` — verify output is red.
- **Non-uniform scale normal artifact** (known issue): scale `[2, 1, 1]`, verify normals appear sheared — document as expected behavior.
- **Quad2D depth**: create Quad2D and a mesh at the same NDC position — verify Quad2D renders on top.
- **Quad3D depth test**: create Quad3D behind a solid mesh — verify Quad3D is occluded.
- **Quad3D back-face**: view a Quad3D from behind — verify it is visible (no back-face culling).
- **FBX vertex layout stride**: verify FBX vertex buffer stride is 64 bytes, not 48.
- **Camera group 0 declared in Quad2D**: verify adding a camera bind group to a Quad2D draw call does not cause a validation error.
