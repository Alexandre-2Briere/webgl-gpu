export const MESH = /* wgsl */`
// 3D mesh shader — CCW winding, back-face culling, simple diffuse + ambient.
// Prepend common.wgsl before compiling.

struct VIn {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
  @location(2) color    : vec4f,
}

struct VOut {
  @builtin(position) clip     : vec4f,
  @location(0)       worldPos : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       color    : vec4f,
}

@vertex fn vs(v : VIn) -> VOut {
  let worldPos = (object.model * vec4f(v.position, 1.0)).xyz;
  let worldNrm = normalize((object.model * vec4f(v.normal, 0.0)).xyz);
  return VOut(
    camera.viewProj * vec4f(worldPos, 1.0),
    worldPos,
    worldNrm,
    v.color * object.tint,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  let light = normalize(vec3f(0.577, 0.577, 0.577));
  let diff  = max(dot(in.normal, light), 0.0);
  let lit   = in.color.rgb * (0.3 + 0.7 * diff);
  return vec4f(lit, in.color.a);
}
`;
