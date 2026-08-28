/** @internal */
export const BAR3D = /* wgsl */`
// Instanced Y-axis-billboarded progress bar — prepend common.wgsl.

struct BarInstance {
  position:        vec3f,   // bytes  0–11
  percentage:      f32,     // bytes 12–15
  size:            vec2f,   // bytes 16–23
  borderThickness: f32,     // bytes 24–27
  visible:         f32,     // bytes 28–31
  borderColor:     vec4f,   // bytes 32–47
  fillColor:       vec4f,   // bytes 48–63
  emptyColor:      vec4f,   // bytes 64–79
}

@group(2) @binding(0) var<storage, read> instances : array<BarInstance>;

struct VOut {
  @builtin(position)              clip:          vec4f,
  @location(0)                    uv:            vec2f,
  @location(1) @interpolate(flat) instanceIndex: u32,
}

fn _localPos(vi: u32) -> vec2f {
  switch vi {
    case 0u: { return vec2f(-0.5,  0.5); }
    case 1u: { return vec2f( 0.5,  0.5); }
    case 2u: { return vec2f( 0.5, -0.5); }
    case 3u: { return vec2f(-0.5,  0.5); }
    case 4u: { return vec2f( 0.5, -0.5); }
    default: { return vec2f(-0.5, -0.5); }
  }
}

fn _localUV(vi: u32) -> vec2f {
  switch vi {
    case 0u: { return vec2f(0.0, 0.0); }
    case 1u: { return vec2f(1.0, 0.0); }
    case 2u: { return vec2f(1.0, 1.0); }
    case 3u: { return vec2f(0.0, 0.0); }
    case 4u: { return vec2f(1.0, 1.0); }
    default: { return vec2f(0.0, 1.0); }
  }
}

@vertex fn vs(
  @builtin(vertex_index)   vertexIndex:   u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VOut {
  let bar = instances[instanceIndex];

  // Invisible slot → degenerate vertex, triangle clipped entirely
  if (bar.visible < 0.5) {
    return VOut(vec4f(2.0, 0.0, 0.0, 1.0), vec2f(0.0), instanceIndex);
  }

  let local = _localPos(vertexIndex);
  let uv    = _localUV(vertexIndex);

  // Y-axis billboard: rotate to face camera on XZ plane only (no pitch tilt)
  let toCam   = camera.position - bar.position;
  let toCamXZ = vec3f(toCam.x, 0.0, toCam.z);
  let dist    = length(toCamXZ);
  let forward = select(vec3f(0.0, 0.0, 1.0), toCamXZ / dist, dist > 0.001);
  let right   = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
  let up      = vec3f(0.0, 1.0, 0.0);

  let worldPos = bar.position
    + right * (local.x * bar.size.x)
    + up    * (local.y * bar.size.y);

  return VOut(camera.viewProj * vec4f(worldPos, 1.0), uv, instanceIndex);
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let bar = instances[in.instanceIndex];
  let uv  = in.uv;

  let borderX = bar.borderThickness / bar.size.x;
  let borderY = bar.borderThickness / bar.size.y;

  let onBorder = uv.x < borderX     || uv.x > (1.0 - borderX)
              || uv.y < borderY     || uv.y > (1.0 - borderY);
  if (onBorder) { return bar.borderColor; }

  let innerU = (uv.x - borderX) / (1.0 - 2.0 * borderX);
  if (innerU < bar.percentage) { return bar.fillColor; }
  return bar.emptyColor;
}
`;
