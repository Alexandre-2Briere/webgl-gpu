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
  // Backward compat: no lights present → flat color
  if (lights.count == 0u) {
    return in.color;
  }

  var totalAmbient : vec3f = vec3f(0.0);
  for (var i : u32 = 0u; i < lights.count; i++) {
    if (lights.lights[i].lightType == 0u) {
      totalAmbient += lights.lights[i].color;
    }
    // Point lights ignored — quad3d has no surface normal
  }

  let contribution = clamp(totalAmbient, vec3f(0.0), vec3f(1.0));
  return vec4f(in.color.rgb * contribution, in.color.a);
}
