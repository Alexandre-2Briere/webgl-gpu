import { dot, safeNorm3, type Vec3 } from '../../../../math/vec';
import type { CapsuleHitbox } from '../../hitbox/CapsuleHitbox';
import type { CubeHitbox } from '../../hitbox/CubeHitbox';
import type { MeshHitbox } from '../../hitbox/MeshHitbox';

// ─── Result type ──────────────────────────────────────────────────────────────

/** @internal */
export interface CollisionResult { hit: boolean; depth: number; normal: Vec3 }
/** @internal */
export const NO_HIT: CollisionResult = { hit: false, depth: 0, normal: [0, 1, 0] };

/** @internal */
export function flipNormal(result: CollisionResult): CollisionResult {
  return result.hit
    ? { hit: true, depth: result.depth, normal: [-result.normal[0], -result.normal[1], -result.normal[2]] }
    : result;
}

// ─── OBB helpers ──────────────────────────────────────────────────────────────

/** @internal */
export function extractOBBAxes(orientation: Float32Array): [Vec3, Vec3, Vec3] {
  return [
    [orientation[0], orientation[1], orientation[2]],
    [orientation[4], orientation[5], orientation[6]],
    [orientation[8], orientation[9], orientation[10]],
  ];
}

/**
 * Projects an OBB onto a separating axis and returns [min, max] on that axis.
 * The support radius uses the SAT formula: sum of |dot(obbAxis_i, axis)| × halfExtent_i.
 * @internal
 */
export function projectOBBOntoAxis(
  center: Vec3,
  axes: [Vec3, Vec3, Vec3],
  halfExtents: Vec3,
  axis: Vec3,
): [number, number] {
  const centerProjection = dot(center, axis);
  const projectedRadius = Math.abs(dot(axes[0], axis)) * halfExtents[0]
                        + Math.abs(dot(axes[1], axis)) * halfExtents[1]
                        + Math.abs(dot(axes[2], axis)) * halfExtents[2];
  return [centerProjection - projectedRadius, centerProjection + projectedRadius];
}

// ─── Segment helpers ──────────────────────────────────────────────────────────

/** @internal */
export function closestPointOnSegment(segStart: Vec3, segEnd: Vec3, point: Vec3): Vec3 {
  const direction: Vec3 = [segEnd[0] - segStart[0], segEnd[1] - segStart[1], segEnd[2] - segStart[2]];
  const lengthSq = dot(direction, direction);
  if (lengthSq < 1e-10) {
    return [segStart[0], segStart[1], segStart[2]];
  }
  const toPoint: Vec3 = [point[0] - segStart[0], point[1] - segStart[1], point[2] - segStart[2]];
  const param = Math.max(0, Math.min(1, dot(toPoint, direction) / lengthSq));
  return [segStart[0] + direction[0] * param, segStart[1] + direction[1] * param, segStart[2] + direction[2] * param];
}

/**
 * Returns the two hemisphere-center endpoints of the capsule's inner cylinder segment.
 * The half-segment length is `height/2 - radius` — subtracting the hemisphere radius
 * from each end so the segment spans only the cylindrical body, not the full height.
 * @internal
 */
export function getCapsuleSegment(capsule: CapsuleHitbox): [Vec3, Vec3] {
  const center = capsule.worldCenter;
  const halfSegmentLength = Math.max(0, capsule.height * 0.5 - capsule.radius);
  const upAxis: Vec3 = [capsule.orientation[4], capsule.orientation[5], capsule.orientation[6]];
  return [
    [center[0] - upAxis[0] * halfSegmentLength, center[1] - upAxis[1] * halfSegmentLength, center[2] - upAxis[2] * halfSegmentLength],
    [center[0] + upAxis[0] * halfSegmentLength, center[1] + upAxis[1] * halfSegmentLength, center[2] + upAxis[2] * halfSegmentLength],
  ];
}

// ─── Shared geometry tests ────────────────────────────────────────────────────

/** Point + radius vs OBB. Normal points from OBB toward the point. @internal */
export function pointRadiusVsOBB(point: Vec3, radius: number, cube: CubeHitbox): CollisionResult {
  const obbCenter = cube.worldCenter;
  const axes = extractOBBAxes(cube.orientation);
  const halfExtents = cube.halfExtents;
  const delta: Vec3 = [point[0] - obbCenter[0], point[1] - obbCenter[1], point[2] - obbCenter[2]];
  const localPoint: Vec3 = [dot(delta, axes[0]), dot(delta, axes[1]), dot(delta, axes[2])];
  const insideOBB = Math.abs(localPoint[0]) <= halfExtents[0]
                 && Math.abs(localPoint[1]) <= halfExtents[1]
                 && Math.abs(localPoint[2]) <= halfExtents[2];
  if (insideOBB) {
    const overlap: Vec3 = [
      halfExtents[0] - Math.abs(localPoint[0]),
      halfExtents[1] - Math.abs(localPoint[1]),
      halfExtents[2] - Math.abs(localPoint[2]),
    ];
    let depth: number;
    let normal: Vec3;
    if (overlap[0] <= overlap[1] && overlap[0] <= overlap[2]) {
      depth = overlap[0] + radius;
      const sign = localPoint[0] < 0 ? -1 : 1;
      normal = [axes[0][0] * sign, axes[0][1] * sign, axes[0][2] * sign];
    } else if (overlap[1] <= overlap[0] && overlap[1] <= overlap[2]) {
      depth = overlap[1] + radius;
      const sign = localPoint[1] < 0 ? -1 : 1;
      normal = [axes[1][0] * sign, axes[1][1] * sign, axes[1][2] * sign];
    } else {
      depth = overlap[2] + radius;
      const sign = localPoint[2] < 0 ? -1 : 1;
      normal = [axes[2][0] * sign, axes[2][1] * sign, axes[2][2] * sign];
    }
    return { hit: true, depth, normal };
  }
  const clamped: Vec3 = [
    Math.max(-halfExtents[0], Math.min(halfExtents[0], localPoint[0])),
    Math.max(-halfExtents[1], Math.min(halfExtents[1], localPoint[1])),
    Math.max(-halfExtents[2], Math.min(halfExtents[2], localPoint[2])),
  ];
  const closestPoint: Vec3 = [
    obbCenter[0] + clamped[0] * axes[0][0] + clamped[1] * axes[1][0] + clamped[2] * axes[2][0],
    obbCenter[1] + clamped[0] * axes[0][1] + clamped[1] * axes[1][1] + clamped[2] * axes[2][1],
    obbCenter[2] + clamped[0] * axes[0][2] + clamped[1] * axes[1][2] + clamped[2] * axes[2][2],
  ];
  const toPoint: Vec3 = [point[0] - closestPoint[0], point[1] - closestPoint[1], point[2] - closestPoint[2]];
  const squaredDist = dot(toPoint, toPoint);
  if (squaredDist >= radius * radius) return NO_HIT;
  const distance = Math.sqrt(squaredDist);
  return { hit: true, depth: radius - distance, normal: safeNorm3(toPoint) };
}

/** Point + radius vs AABB (mesh). Normal points from AABB toward the point. @internal */
export function pointRadiusVsAABB(point: Vec3, radius: number, mesh: MeshHitbox): CollisionResult {
  const meshCenter = mesh.worldCenter;
  const halfExtents = mesh.halfExtents;
  const delta: Vec3 = [point[0] - meshCenter[0], point[1] - meshCenter[1], point[2] - meshCenter[2]];
  const insideAABB = Math.abs(delta[0]) <= halfExtents[0]
                  && Math.abs(delta[1]) <= halfExtents[1]
                  && Math.abs(delta[2]) <= halfExtents[2];
  if (insideAABB) {
    const overlap: Vec3 = [
      halfExtents[0] - Math.abs(delta[0]),
      halfExtents[1] - Math.abs(delta[1]),
      halfExtents[2] - Math.abs(delta[2]),
    ];
    let depth: number;
    let normal: Vec3;
    if (overlap[0] <= overlap[1] && overlap[0] <= overlap[2]) {
      depth = overlap[0] + radius;
      normal = [delta[0] < 0 ? -1 : 1, 0, 0];
    } else if (overlap[1] <= overlap[0] && overlap[1] <= overlap[2]) {
      depth = overlap[1] + radius;
      normal = [0, delta[1] < 0 ? -1 : 1, 0];
    } else {
      depth = overlap[2] + radius;
      normal = [0, 0, delta[2] < 0 ? -1 : 1];
    }
    return { hit: true, depth, normal };
  }
  const clamped: Vec3 = [
    Math.max(-halfExtents[0], Math.min(halfExtents[0], delta[0])),
    Math.max(-halfExtents[1], Math.min(halfExtents[1], delta[1])),
    Math.max(-halfExtents[2], Math.min(halfExtents[2], delta[2])),
  ];
  const toPoint: Vec3 = [delta[0] - clamped[0], delta[1] - clamped[1], delta[2] - clamped[2]];
  const squaredDist = dot(toPoint, toPoint);
  if (squaredDist >= radius * radius) return NO_HIT;
  const distance = Math.sqrt(squaredDist);
  return { hit: true, depth: radius - distance, normal: safeNorm3(toPoint) };
}
