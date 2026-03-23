export const QUAD2D = /* wgsl */`
// Screen-space quad shader — NDC positions, flat tint color, no depth.
// Prepend common.wgsl before compiling.
// Note: group 0 (camera) and group 1 (object) are declared in common.wgsl,
// but only group 1 tint is used here (no camera transform needed for 2D).

struct VIn {
  @location(0) position : vec2f,
  @location(1) color    : vec4f,
}

struct VOut {
  @builtin(position) clip  : vec4f,
  @location(0)       color : vec4f,
}

@vertex fn vs(v : VIn) -> VOut {
  return VOut(
    vec4f(v.position, 0.0, 1.0),
    v.color * object.tint,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  return in.color;
}
`;
