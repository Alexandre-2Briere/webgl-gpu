/** @internal */
export const TEXT = /* wgsl */`
// Text quad shader — samples a per-slot canvas texture.
// Prepend common.wgsl before compiling.
// Groups 0 (camera) and 1 (object) are declared in common.wgsl.
// Group 2 holds the canvas texture and sampler.

@group(2) @binding(0) var textTexture : texture_2d<f32>;
@group(2) @binding(1) var textSampler : sampler;

struct VIn {
  @location(0) position : vec2f,
  @location(1) uv       : vec2f,
}

struct VOut {
  @builtin(position) clip : vec4f,
  @location(0)       uv   : vec2f,
}

// Screen-space variant — model matrix is already in NDC (no camera transform needed).
@vertex fn vs_screen(v : VIn) -> VOut {
  return VOut(
    object.model * vec4f(v.position, 0.0, 1.0),
    v.uv,
  );
}

// World-space billboard variant — quad always faces the camera using view axes.
@vertex fn vs_world(v : VIn) -> VOut {
  let right    = vec3f(camera.view[0][0], camera.view[1][0], camera.view[2][0]);
  let up       = vec3f(camera.view[0][1], camera.view[1][1], camera.view[2][1]);
  let center   = object.model[3].xyz;
  let worldPos = center
               + right * v.position.x * object.model[0][0]
               + up    * v.position.y * object.model[1][1];
  return VOut(
    camera.viewProj * vec4f(worldPos, 1.0),
    v.uv,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  return textureSample(textTexture, textSampler, in.uv);
}
`;
