/** @internal */
export const MESH_PHONG = /* wgsl */`
// Blinn-Phong mesh shader — UV + material uniforms at group 2.
// Prepend common.wgsl and phong.wgsl before compiling.

struct MaterialUniforms {
  shininess       : f32,
  specularStrength: f32,
  hasTexture      : u32,
  _pad            : f32,
}

@group(2) @binding(0) var<uniform> material   : MaterialUniforms;
@group(2) @binding(1) var          diffuseTex : texture_2d<f32>;
@group(2) @binding(2) var          texSampler : sampler;

struct VIn {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
  @location(2) color    : vec4f,
  @location(3) uv       : vec2f,
}

struct VOut {
  @builtin(position) clip     : vec4f,
  @location(0)       worldPos : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       color    : vec4f,
  @location(3)       uv       : vec2f,
}

@vertex fn vs(v : VIn) -> VOut {
  let worldPos = (object.model * vec4f(v.position, 1.0)).xyz;
  let worldNrm = normalize((object.model * vec4f(v.normal, 0.0)).xyz);
  return VOut(
    camera.viewProj * vec4f(worldPos, 1.0),
    worldPos,
    worldNrm,
    v.color * object.tint,
    v.uv,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  // Backward compat: no lights present → old hardcoded directional, no specular
  if (lights.count == 0u) {
    let lightDir = normalize(vec3f(0.577, 0.577, 0.577));
    let diffuse  = max(dot(in.normal, lightDir), 0.0);
    return vec4f(in.color.rgb * (0.7 * diffuse), in.color.a);
  }

  var baseColor = in.color;
  if (material.hasTexture != 0u) {
    baseColor = textureSample(diffuseTex, texSampler, in.uv) * in.color;
  }

  let normal  = normalize(in.normal);
  let viewDir = normalize(camera.position - in.worldPos);

  var totalAmbient  : vec3f = vec3f(0.0);
  var totalDiffuse  : vec3f = vec3f(0.0);
  var totalSpecular : vec3f = vec3f(0.0);

  for (var i : u32 = 0u; i < lights.count; i++) {
    let light = lights.lights[i];

    if (light.lightType == 0u) {
      // Ambient — radius field carries intensity for ambient lights
      totalAmbient += light.color * light.radius;

    } else if (light.lightType == 1u) {
      // Point
      let toLight     = light.position - in.worldPos;
      let distance    = length(toLight);
      if (distance < light.radius) {
        let attenuation = 1.0 - distance / light.radius;
        let lightDir    = normalize(toLight);
        let diffuse     = max(dot(normal, lightDir), 0.0) * attenuation;
        let specular    = phongSpecular(normal, lightDir, viewDir, material.shininess)
                        * material.specularStrength * attenuation;
        totalDiffuse  += light.color * diffuse;
        totalSpecular += light.color * specular;
      }

    } else {
      // Directional — position slot holds the direction vector
      let lightDir = normalize(light.position);
      let diffuse  = max(dot(normal, lightDir), 0.0);
      let specular = phongSpecular(normal, lightDir, viewDir, material.shininess)
                   * material.specularStrength;
      totalDiffuse  += light.color * diffuse;
      totalSpecular += light.color * specular;
    }
  }

  let contribution = clamp(totalAmbient + totalDiffuse, vec3f(0.0), vec3f(1.0));
  let litColor     = baseColor.rgb * contribution + totalSpecular;
  return vec4f(clamp(litColor, vec3f(0.0), vec3f(1.0)), baseColor.a);
}
`;
