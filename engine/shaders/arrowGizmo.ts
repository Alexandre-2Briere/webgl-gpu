/** @internal */
export const ARROW_GIZMO_VISIBLE_KEY  = 'arrow-gizmo-visible';
/** @internal */
export const ARROW_GIZMO_OCCLUDED_KEY = 'arrow-gizmo-occluded';

/** @internal */
export const ARROW_GIZMO = /* wgsl */`
// ArrowGizmo shader — procedural axis arrows, two-pipeline occluded rendering.
// Prepend common.wgsl before compiling.
// No vertex buffer: all geometry generated from @builtin(vertex_index).
// pass.draw(288) — 96 vertices per arrow × 3 arrows.
//
// Group 2 (gizmo-specific):
//   binding 0: GizmoUniforms

struct GizmoUniforms {
  colorX        : vec4f,   // offset  0 — X-axis RGBA color
  colorY        : vec4f,   // offset 16 — Y-axis RGBA color
  colorZ        : vec4f,   // offset 32 — Z-axis RGBA color
  visibilityMask: u32,     // offset 48 — bits 0/1/2 = X/Y/Z axis visible
  _pad0         : u32,     // offset 52 — padding for 16-byte alignment
  _pad          : vec2u,   // offset 56 — padding to 64 bytes
}

@group(2) @binding(0) var<uniform> gizmo : GizmoUniforms;

const TAU             = 6.28318530718;
const N_SIDES         = 8u;
const SHAFT_RADIUS    = 0.03;
const CONE_RADIUS     = 0.08;
const SHAFT_LENGTH    = 0.75;
const VERTS_PER_ARROW = 96u;

// Quad corner index → vertex corners: maps the 6-vert quad to two CCW triangles.
// Corners: 0 = bottom-left, 1 = bottom-right, 2 = top-right, 3 = top-left
const QUAD_CORNER = array<u32, 6>(0u, 2u, 1u, 0u, 3u, 2u);

// Remaps local +Z cylinder direction onto each world axis.
// axis 0 → +X, axis 1 → +Y, axis 2 → +Z
fn axisRotate(p: vec3f, axis: u32) -> vec3f {
  switch axis {
    case 0u: { return vec3f(p.z, p.y, p.x); }
    case 1u: { return vec3f(p.x, p.z, p.y); }
    default: { return p; }
  }
}

struct VOut {
  @builtin(position) clip        : vec4f,
  @location(0)       axisColor   : vec4f,
}

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let arrowIndex = vi / VERTS_PER_ARROW;
  let localVi    = vi % VERTS_PER_ARROW;

  var out: VOut;

  // Cull invisible axes: output a degenerate clip position behind the near plane.
  let isVisible = (gizmo.visibilityMask >> arrowIndex) & 1u;
  if isVisible == 0u {
    out.clip         = vec4f(0.0, 0.0, -2.0, 1.0);
    out.axisColor    = vec4f(0.0);
    return out;
  }

  // Select per-axis color.
  var axisColor: vec4f;
  switch arrowIndex {
    case 0u: { axisColor = gizmo.colorX; }
    case 1u: { axisColor = gizmo.colorY; }
    default: { axisColor = gizmo.colorZ; }
  }

  var localPos: vec3f;

  if localVi < 48u {
    // ── Cylinder shaft sides: 8 slices × 6 verts = 48 ──────────────────────
    let slice  = localVi / 6u;
    let corner = QUAD_CORNER[localVi % 6u];
    // Corner 0,3 use the current slice angle; 1,2 use the next slice angle.
    let isRight    = (corner == 1u) || (corner == 2u);
    let isTop      = corner >= 2u;
    let sliceIndex = select(slice, (slice + 1u) % N_SIDES, isRight);
    let angle      = f32(sliceIndex) * TAU / f32(N_SIDES);
    let zHeight    = select(0.0, SHAFT_LENGTH, isTop);
    localPos = vec3f(cos(angle) * SHAFT_RADIUS, sin(angle) * SHAFT_RADIUS, zHeight);

  } else if localVi < 72u {
    // ── Cone sides: 8 triangles × 3 verts = 24 ─────────────────────────────
    let coneLocalVi = localVi - 48u;
    let slice       = coneLocalVi / 3u;
    let triVertex   = coneLocalVi % 3u;
    switch triVertex {
      case 0u: {
        // Apex at the tip
        localPos = vec3f(0.0, 0.0, 1.0);
      }
      case 1u: {
        // Ring point at current slice (CCW when viewed from outside)
        let angle = f32(slice) * TAU / f32(N_SIDES);
        localPos  = vec3f(cos(angle) * CONE_RADIUS, sin(angle) * CONE_RADIUS, SHAFT_LENGTH);
      }
      default: {
        // Ring point at next slice
        let angle = f32((slice + 1u) % N_SIDES) * TAU / f32(N_SIDES);
        localPos  = vec3f(cos(angle) * CONE_RADIUS, sin(angle) * CONE_RADIUS, SHAFT_LENGTH);
      }
    }

  } else {
    // ── Cone base disc cap: 8 triangles × 3 verts = 24 ──────────────────────
    // Reversed winding relative to cone sides so the cap faces downward (−Z local).
    let baseLocalVi = localVi - 72u;
    let slice       = baseLocalVi / 3u;
    let triVertex   = baseLocalVi % 3u;
    switch triVertex {
      case 0u: {
        // Disc center
        localPos = vec3f(0.0, 0.0, SHAFT_LENGTH);
      }
      case 1u: {
        // Ring point at next slice (reversed winding vs cone sides)
        let angle = f32((slice + 1u) % N_SIDES) * TAU / f32(N_SIDES);
        localPos  = vec3f(cos(angle) * CONE_RADIUS, sin(angle) * CONE_RADIUS, SHAFT_LENGTH);
      }
      default: {
        // Ring point at current slice
        let angle = f32(slice) * TAU / f32(N_SIDES);
        localPos  = vec3f(cos(angle) * CONE_RADIUS, sin(angle) * CONE_RADIUS, SHAFT_LENGTH);
      }
    }
  }

  // Rotate local +Z geometry onto the correct world axis.
  let rotated  = axisRotate(localPos, arrowIndex);

  // Apply gizmo TRS model matrix (origin, orientation, scale).
  let worldPos = (object.model * vec4f(rotated, 1.0)).xyz;

  out.clip         = camera.viewProj * vec4f(worldPos, 1.0);
  out.axisColor    = axisColor;
  return out;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  return vec4f(in.axisColor.rgb, 1);
}
`;
