// Light ball gizmo shader — screen-space overlay, procedural geometry.
// Prepend common.wgsl before compiling.
// No vertex buffer needed: geometry is hardcoded in the vertex shader.
// CPU writes center (NDC) and scale into the model matrix uniform each frame:
//   model[0][0] = x scale, model[1][1] = y scale
//   model[3][0] = NDC center x, model[3][1] = NDC center y
// The tint uniform carries the light color RGBA.
// The quad is the cube's screen-facing face; the fragment shader reconstructs
// a sphere normal to produce a 3D glowing ball appearance.

// 6 vertices for a unit quad [-1,1]×[-1,1] — the cube's screen-facing face
const QUAD_POSITIONS = array<vec2f, 6>(
  vec2f(-1.0, -1.0), vec2f(-1.0,  1.0), vec2f( 1.0,  1.0),
  vec2f(-1.0, -1.0), vec2f( 1.0,  1.0), vec2f( 1.0, -1.0),
);

struct VOut {
  @builtin(position) clip     : vec4f,
  @location(0)       color    : vec4f,
  @location(1)       localPos : vec2f,   // [-1,1] local coords for sphere calc
}

@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> VOut {
  let scale    = vec2f(object.model[0][0], object.model[1][1]);
  let center   = vec2f(object.model[3][0], object.model[3][1]);
  let local    = QUAD_POSITIONS[vertexIndex];
  let position = local * scale + center;
  return VOut(vec4f(position, 0.0, 1.0), object.tint, local);
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let dist2d = length(in.localPos);
  if (dist2d >= 1.0) { discard; }

  // Reconstruct sphere surface normal from billboard position.
  // sphereNormalZ is the depth component — 1.0 at center, 0.0 at the equator.
  let sphereNormalZ = sqrt(1.0 - dist2d * dist2d);

  // Core glow: bright at center, falls off exponentially toward the edge.
  let core = exp(-dist2d * 2.5);
  // Rim halo: Fresnel-like glow at the sphere silhouette.
  let rim  = pow(1.0 - sphereNormalZ, 3.0) * 0.5;

  let alpha = clamp(core + rim, 0.0, 1.0) * in.color.a;
  return vec4f(in.color.rgb, alpha);
}
