export const QUAD3D = /* wgsl */`
// World-space quad shader — depth-tested, no back-face culling, flat tint color.
// Prepend common.wgsl before compiling.

struct VIn {
  @location(0) position : vec3f,
  @location(1) color    : vec4f,
}

struct VOut {
  @builtin(position) clip  : vec4f,
  @location(0)       color : vec4f,
}

@vertex fn vs(v : VIn) -> VOut {
  let worldPos = (object.model * vec4f(v.position, 1.0)).xyz;
  return VOut(
    camera.viewProj * vec4f(worldPos, 1.0),
    v.color * object.tint,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  return in.color;
}
`;
