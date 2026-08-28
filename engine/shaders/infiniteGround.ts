/** @internal */
export const INFINITE_GROUND = /* wgsl */`
// Infinite checkerboard ground shader.
// Prepend common.wgsl before compiling.
// Group 1 (object): model mat4 + color1 (tint)
// Group 2 (groundExtra): color2 (vec4f) + tileSize (f32)

struct GroundExtra {
  color2   : vec4f,
  tileSize : f32,
}

@group(2) @binding(0) var<uniform> groundExtra : GroundExtra;

struct VIn {
  @location(0) position : vec3f,
}

struct VOut {
  @builtin(position) clip     : vec4f,
  @location(0)       worldPos : vec3f,
  @location(1)       tint     : vec4f,
}

@vertex fn vs(v : VIn) -> VOut {
  let worldPos = (object.model * vec4f(v.position, 1.0)).xyz;
  return VOut(
    camera.viewProj * vec4f(worldPos, 1.0),
    worldPos,
    object.tint,
  );
}

@fragment fn fs(in : VOut) -> @location(0) vec4f {
  let tileX    = i32(floor(in.worldPos.x / groundExtra.tileSize));
  let tileZ    = i32(floor(in.worldPos.z / groundExtra.tileSize));
  let checker  = (tileX + tileZ) & 1;
  if (checker == 0) {
    return in.tint;
  }
  return groundExtra.color2;
}
`;
