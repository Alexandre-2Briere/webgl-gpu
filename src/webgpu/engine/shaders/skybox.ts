/** @internal */
export const SKYBOX = /* wgsl */`
// Skybox shader — fullscreen procedural quad, solid tint color, no depth write.
// Prepend common.wgsl before compiling.
// Renders before world geometry as a background fill.

struct VOut {
  @builtin(position) clip  : vec4f,
  @location(0)       color : vec4f,
}

// 6 vertices covering the entire clip space (two CCW triangles).
// z = 1.0, w = 1.0 → NDC depth = 1.0 (max depth, behind all geometry).
var<private> POSITIONS : array<vec2f, 6> = array<vec2f, 6>(
  vec2f(-1.0, -1.0),
  vec2f( 1.0, -1.0),
  vec2f(-1.0,  1.0),
  vec2f(-1.0,  1.0),
  vec2f( 1.0, -1.0),
  vec2f( 1.0,  1.0),
);

@vertex fn vs(@builtin(vertex_index) vi : u32) -> VOut {
  return VOut(
    vec4f(POSITIONS[vi], 1.0, 1.0),
    object.tint,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  return in.color;
}
`;
