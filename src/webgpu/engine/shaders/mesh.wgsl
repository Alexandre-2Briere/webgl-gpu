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
  // Backward compat: no lights present → old hardcoded directional
  if (lights.count == 0u) {
    let lightDir = normalize(vec3f(0.577, 0.577, 0.577));
    let diff     = max(dot(in.normal, lightDir), 0.0);
    return vec4f(in.color.rgb * (0.7 * diff), in.color.a);
  }

  var totalAmbient : vec3f = vec3f(0.0);
  var totalDiffuse : vec3f = vec3f(0.0);

  for (var i : u32 = 0u; i < lights.count; i++) {
    let light = lights.lights[i];
    if (light.lightType == 0u) {
      totalAmbient += light.color.rgb * light.radius;
    } else if (light.lightType == 1u) {
      let toLight     = light.position - in.worldPos;
      let distance    = length(toLight);
      if (distance < light.radius) {
        let attenuation = 1.0 - distance / light.radius;
        let diffuse     = max(dot(in.normal, normalize(toLight)), 0.0);
        totalDiffuse   += light.color * diffuse * attenuation;
      }
    } else {
      // Directional light — position field stores the world-space light direction
      let lightDir = normalize(light.position);
      let diffuse  = max(dot(in.normal, lightDir), 0.0);
      totalDiffuse += light.color * diffuse * light.radius;
    }
  }

  let contribution = clamp(totalAmbient + totalDiffuse, vec3f(0.0), vec3f(1.0));
  return vec4f(in.color.rgb * contribution, in.color.a);
}
