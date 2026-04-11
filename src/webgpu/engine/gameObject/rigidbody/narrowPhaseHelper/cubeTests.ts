import type { CubeHitbox, SphereHitbox, CapsuleHitbox, MeshHitbox } from '../../hitbox';
import { dot, norm3, cross3, type Vec3 } from '../../../math';
import {
  type CollisionResult, NO_HIT, flipNormal,
  extractOBBAxes, projectOBBOntoAxis,
  pointRadiusVsOBB,
} from './helpers';
import { testCapsuleCube } from './capsuleTests';
import { testMeshCube } from './meshTests';

export function testCubeCube(a: CubeHitbox, b: CubeHitbox): CollisionResult {
  const centerA = a.worldCenter;
  const centerB = b.worldCenter;
  const axesA = extractOBBAxes(a.orientation);
  const axesB = extractOBBAxes(b.orientation);
  const halfExtentsA = a.halfExtents;
  const halfExtentsB = b.halfExtents;
  const centerDelta: Vec3 = [centerB[0] - centerA[0], centerB[1] - centerA[1], centerB[2] - centerA[2]];
  const separatingAxes: Vec3[] = [
    ...axesA,
    ...axesB,
    norm3(cross3(axesA[0], axesB[0])), norm3(cross3(axesA[0], axesB[1])), norm3(cross3(axesA[0], axesB[2])),
    norm3(cross3(axesA[1], axesB[0])), norm3(cross3(axesA[1], axesB[1])), norm3(cross3(axesA[1], axesB[2])),
    norm3(cross3(axesA[2], axesB[0])), norm3(cross3(axesA[2], axesB[1])), norm3(cross3(axesA[2], axesB[2])),
  ];
  let minPenetrationDepth = Infinity;
  let minPenetrationNormal: Vec3 = [0, 1, 0];
  for (const axis of separatingAxes) {
    if (dot(axis, axis) < 1e-10) continue;
    const [minA, maxA] = projectOBBOntoAxis(centerA, axesA, halfExtentsA, axis);
    const [minB, maxB] = projectOBBOntoAxis(centerB, axesB, halfExtentsB, axis);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return NO_HIT;
    if (overlap < minPenetrationDepth) {
      minPenetrationDepth = overlap;
      const sign = dot(centerDelta, axis) > 0 ? 1 : -1;
      minPenetrationNormal = [axis[0] * sign, axis[1] * sign, axis[2] * sign];
    }
  }
  return { hit: true, depth: minPenetrationDepth, normal: minPenetrationNormal };
}

export function testCubeSphere(cube: CubeHitbox, sphere: SphereHitbox): CollisionResult {
  return flipNormal(pointRadiusVsOBB(sphere.worldCenter, sphere.radius, cube));
}

export function testCubeCapsule(cube: CubeHitbox, capsule: CapsuleHitbox): CollisionResult {
  return flipNormal(testCapsuleCube(capsule, cube));
}

export function testCubeMesh(cube: CubeHitbox, mesh: MeshHitbox): CollisionResult {
  return flipNormal(testMeshCube(mesh, cube));
}
