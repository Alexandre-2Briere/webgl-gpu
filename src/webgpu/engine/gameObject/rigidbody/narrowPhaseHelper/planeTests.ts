import type { PlaneHitbox } from '../../hitbox/PlaneHitbox';
import type { SphereHitbox } from '../../hitbox/SphereHitbox';
import type { CubeHitbox } from '../../hitbox/CubeHitbox';
import type { CapsuleHitbox } from '../../hitbox/CapsuleHitbox';
import type { MeshHitbox } from '../../hitbox/MeshHitbox';
import { type CollisionResult, NO_HIT, extractOBBAxes } from './helpers';
import type { Vec3 } from '../../../math';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns the index (0=x, 1=y, 2=z) for a PlaneHitbox axis. */
function axisIndex(plane: PlaneHitbox): 0 | 1 | 2 {
  if (plane.axis === 'x') return 0;
  if (plane.axis === 'y') return 1;
  return 2;
}

/**
 * Builds a CollisionResult for a plane collision.
 * `signedDist` is positive when the other object is on the positive-normal side.
 * `depth` is the penetration magnitude.
 */
function makeResult(signedDist: number, depth: number, planeNormal: Vec3): CollisionResult {
  const sign = signedDist >= 0 ? -1 : 1;
  return {
    hit: true,
    depth,
    normal: [planeNormal[0] * sign, planeNormal[1] * sign, planeNormal[2] * sign],
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

/** @internal */
export function testPlaneSphere(plane: PlaneHitbox, sphere: SphereHitbox): CollisionResult {
  const idx = axisIndex(plane);
  const signedDist = sphere.worldCenter[idx] - plane.planeOffset;
  const absDist = Math.abs(signedDist);
  if (absDist > sphere.radius) return NO_HIT;
  return makeResult(signedDist, sphere.radius - absDist, plane.normal);
}

/** @internal */
export function testPlaneCube(plane: PlaneHitbox, cube: CubeHitbox): CollisionResult {
  const idx = axisIndex(plane);
  const signedDist = cube.worldCenter[idx] - plane.planeOffset;
  // Project OBB half-extents onto the plane normal (just the relevant axis component)
  const axes = extractOBBAxes(cube.orientation);
  const support = Math.abs(axes[0][idx]) * cube.halfExtents[0]
                + Math.abs(axes[1][idx]) * cube.halfExtents[1]
                + Math.abs(axes[2][idx]) * cube.halfExtents[2];
  const absDist = Math.abs(signedDist);
  if (absDist > support) return NO_HIT;
  return makeResult(signedDist, support - absDist, plane.normal);
}

/** @internal */
export function testPlaneCapsule(plane: PlaneHitbox, capsule: CapsuleHitbox): CollisionResult {
  const idx = axisIndex(plane);
  const center = capsule.worldCenter;
  // Capsule up axis (orientation column 1 = local Y)
  const upAxis: Vec3 = [capsule.orientation[4], capsule.orientation[5], capsule.orientation[6]];
  const halfLen = capsule.height * 0.5;
  // The extreme point of the capsule segment closest to the plane
  const extremeOffset = Math.abs(upAxis[idx]) * halfLen;
  const signedDist = center[idx] - plane.planeOffset;
  const support = extremeOffset + capsule.radius;
  const absDist = Math.abs(signedDist);
  if (absDist > support) return NO_HIT;
  return makeResult(signedDist, support - absDist, plane.normal);
}

/** @internal */
export function testPlaneMesh(plane: PlaneHitbox, mesh: MeshHitbox): CollisionResult {
  const idx = axisIndex(plane);
  const signedDist = mesh.worldCenter[idx] - plane.planeOffset;
  const support = mesh.halfExtents[idx];
  const absDist = Math.abs(signedDist);
  if (absDist > support) return NO_HIT;
  return makeResult(signedDist, support - absDist, plane.normal);
}

/** Two infinite planes never collide in a meaningful way. @internal */
export function testPlanePlane(): CollisionResult {
  return NO_HIT;
}
