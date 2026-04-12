import type { CapsuleHitbox, SphereHitbox, CubeHitbox, MeshHitbox } from '../../hitbox';
import { dot, safeNorm3, type Vec3 } from '../../../math';
import {
  type CollisionResult, NO_HIT, flipNormal,
  pointRadiusVsOBB,
  closestPointOnSegment, getCapsuleSegment,
} from './helpers';
import { testMeshCapsule } from './meshTests';

/** @internal */
export function testCapsuleSphere(capsule: CapsuleHitbox, sphere: SphereHitbox): CollisionResult {
  const [segmentStart, segmentEnd] = getCapsuleSegment(capsule);
  const closestPoint = closestPointOnSegment(segmentStart, segmentEnd, sphere.worldCenter);
  const delta: Vec3 = [sphere.worldCenter[0] - closestPoint[0], sphere.worldCenter[1] - closestPoint[1], sphere.worldCenter[2] - closestPoint[2]];
  const squaredDist = dot(delta, delta);
  const radiusSum = capsule.radius + sphere.radius;
  if (squaredDist >= radiusSum * radiusSum) return NO_HIT;
  const distance = Math.sqrt(squaredDist);
  return { hit: true, depth: radiusSum - distance, normal: safeNorm3(delta) };
}

/** @internal */
export function testCapsuleCube(capsule: CapsuleHitbox, cube: CubeHitbox): CollisionResult {
  const [segmentStart, segmentEnd] = getCapsuleSegment(capsule);
  const closestPoint = closestPointOnSegment(segmentStart, segmentEnd, cube.worldCenter);
  return pointRadiusVsOBB(closestPoint, capsule.radius, cube);
}

/** @internal */
export function testCapsuleCapsule(capsuleA: CapsuleHitbox, capsuleB: CapsuleHitbox): CollisionResult {
  const [segAStart, segAEnd] = getCapsuleSegment(capsuleA);
  const [segBStart, segBEnd] = getCapsuleSegment(capsuleB);
  const dir1: Vec3 = [segAEnd[0] - segAStart[0], segAEnd[1] - segAStart[1], segAEnd[2] - segAStart[2]];
  const dir2: Vec3 = [segBEnd[0] - segBStart[0], segBEnd[1] - segBStart[1], segBEnd[2] - segBStart[2]];
  const startDelta: Vec3 = [segAStart[0] - segBStart[0], segAStart[1] - segBStart[1], segAStart[2] - segBStart[2]];
  const dir1LengthSq = dot(dir1, dir1);
  const dir2LengthSq = dot(dir2, dir2);
  const dir1DotStartDelta = dot(dir1, startDelta);
  let paramS = 0;
  let paramT = 0;
  if (dir1LengthSq >= 1e-10 && dir2LengthSq >= 1e-10) {
    const dir1DotDir2 = dot(dir1, dir2);
    const dir2DotStartDelta = dot(dir2, startDelta);
    const denominator = dir1LengthSq * dir2LengthSq - dir1DotDir2 * dir1DotDir2;
    paramS = denominator > 1e-10
      ? Math.max(0, Math.min(1, (dir1DotDir2 * dir2DotStartDelta - dir2LengthSq * dir1DotStartDelta) / denominator))
      : 0;
    paramT = Math.max(0, Math.min(1, (dir2DotStartDelta + dir1DotDir2 * paramS) / dir2LengthSq));
    paramS = Math.max(0, Math.min(1, (dir1DotDir2 * paramT - dir1DotStartDelta) / dir1LengthSq));
  } else if (dir1LengthSq >= 1e-10) {
    paramS = Math.max(0, Math.min(1, -dir1DotStartDelta / dir1LengthSq));
  } else if (dir2LengthSq >= 1e-10) {
    paramT = Math.max(0, Math.min(1, -dot(dir2, startDelta) / dir2LengthSq));
  }
  const closestPointA: Vec3 = [segAStart[0] + dir1[0] * paramS, segAStart[1] + dir1[1] * paramS, segAStart[2] + dir1[2] * paramS];
  const closestPointB: Vec3 = [segBStart[0] + dir2[0] * paramT, segBStart[1] + dir2[1] * paramT, segBStart[2] + dir2[2] * paramT];
  const delta: Vec3 = [closestPointA[0] - closestPointB[0], closestPointA[1] - closestPointB[1], closestPointA[2] - closestPointB[2]];
  const squaredDist = dot(delta, delta);
  const radiusSum = capsuleA.radius + capsuleB.radius;
  if (squaredDist >= radiusSum * radiusSum) return NO_HIT;
  const distance = Math.sqrt(squaredDist);
  return { hit: true, depth: radiusSum - distance, normal: safeNorm3(delta) };
}

/** @internal */
export function testCapsuleMesh(capsule: CapsuleHitbox, mesh: MeshHitbox): CollisionResult {
  return flipNormal(testMeshCapsule(mesh, capsule));
}
