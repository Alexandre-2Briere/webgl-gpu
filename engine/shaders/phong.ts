/** @internal */
export const PHONG = /* wgsl */`
// Blinn-Phong helpers — prepend to any shader that needs specular lighting.

fn phongSpecular(normal: vec3f, lightDir: vec3f, viewDir: vec3f, shininess: f32) -> f32 {
  let halfVec = normalize(lightDir + viewDir);
  return pow(max(dot(normal, halfVec), 0.0), shininess);
}
`;
