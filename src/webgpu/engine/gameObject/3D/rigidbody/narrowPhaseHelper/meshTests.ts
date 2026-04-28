import type { SphereHitbox } from '../../hitbox/SphereHitbox';
import type { CubeHitbox } from '../../hitbox/CubeHitbox';
import type { CapsuleHitbox } from '../../hitbox/CapsuleHitbox';
import type { MeshHitbox } from '../../hitbox/MeshHitbox';
import { dot, norm3, cross3, type Vec3 } from '../../../../math/vec';
import {
  type CollisionResult, NO_HIT, flipNormal,
  extractOBBAxes, projectOBBOntoAxis,
  pointRadiusVsAABB,
  closestPointOnSegment, getCapsuleSegment,
} from './helpers';

/** @internal */
export function testMeshMesh(meshA: MeshHitbox, meshB: MeshHitbox): CollisionResult {
  const halfExtentsA = meshA.halfExtents;
  const halfExtentsB = meshB.halfExtents;
  const delta: Vec3 = [meshA.worldCenter[0] - meshB.worldCenter[0], meshA.worldCenter[1] - meshB.worldCenter[1], meshA.worldCenter[2] - meshB.worldCenter[2]];
  const overlap: Vec3 = [
    halfExtentsA[0] + halfExtentsB[0] - Math.abs(delta[0]),
    halfExtentsA[1] + halfExtentsB[1] - Math.abs(delta[1]),
    halfExtentsA[2] + halfExtentsB[2] - Math.abs(delta[2]),
  ];
  if (overlap[0] <= 0 || overlap[1] <= 0 || overlap[2] <= 0) return NO_HIT;
  let depth: number;
  let normal: Vec3;
  if (overlap[0] <= overlap[1] && overlap[0] <= overlap[2]) {
    depth = overlap[0];
    normal = [delta[0] < 0 ? -1 : 1, 0, 0];
  } else if (overlap[1] <= overlap[0] && overlap[1] <= overlap[2]) {
    depth = overlap[1];
    normal = [0, delta[1] < 0 ? -1 : 1, 0];
  } else {
    depth = overlap[2];
    normal = [0, 0, delta[2] < 0 ? -1 : 1];
  }
  return { hit: true, depth, normal };
}

/** @internal */
export function testMeshCube(mesh: MeshHitbox, cube: CubeHitbox): CollisionResult {
  const identityAxes: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const meshCenter = mesh.worldCenter;
  const cubeCenter = cube.worldCenter;
  const cubeAxes = extractOBBAxes(cube.orientation);
  const meshHalfExtents = mesh.halfExtents;
  const cubeHalfExtents = cube.halfExtents;
  const centerDelta: Vec3 = [cubeCenter[0] - meshCenter[0], cubeCenter[1] - meshCenter[1], cubeCenter[2] - meshCenter[2]];
  const separatingAxes: Vec3[] = [
    ...identityAxes,
    ...cubeAxes,
    norm3(cross3(identityAxes[0], cubeAxes[0])), norm3(cross3(identityAxes[0], cubeAxes[1])), norm3(cross3(identityAxes[0], cubeAxes[2])),
    norm3(cross3(identityAxes[1], cubeAxes[0])), norm3(cross3(identityAxes[1], cubeAxes[1])), norm3(cross3(identityAxes[1], cubeAxes[2])),
    norm3(cross3(identityAxes[2], cubeAxes[0])), norm3(cross3(identityAxes[2], cubeAxes[1])), norm3(cross3(identityAxes[2], cubeAxes[2])),
  ];
  let minPenetrationDepth = Infinity;
  let minPenetrationNormal: Vec3 = [0, 1, 0];
  for (const axis of separatingAxes) {
    if (dot(axis, axis) < 1e-10) continue;
    const [minA, maxA] = projectOBBOntoAxis(meshCenter, identityAxes, meshHalfExtents, axis);
    const [minB, maxB] = projectOBBOntoAxis(cubeCenter, cubeAxes, cubeHalfExtents, axis);
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

/** @internal */
export function testMeshCapsule(mesh: MeshHitbox, capsule: CapsuleHitbox): CollisionResult {
  const [segmentStart, segmentEnd] = getCapsuleSegment(capsule);
  const closestPoint = closestPointOnSegment(segmentStart, segmentEnd, mesh.worldCenter);
  return pointRadiusVsAABB(closestPoint, capsule.radius, mesh);
}

/** @internal */
export function testMeshSphere(mesh: MeshHitbox, sphere: SphereHitbox): CollisionResult {
  return flipNormal(pointRadiusVsAABB(sphere.worldCenter, sphere.radius, mesh));
}
