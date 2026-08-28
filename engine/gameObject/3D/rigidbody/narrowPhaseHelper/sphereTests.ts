import { dot, safeNorm3, type Vec3 } from '../../../../math/vec';
import {
  type CollisionResult, NO_HIT, flipNormal,
  pointRadiusVsOBB, pointRadiusVsAABB,
} from './helpers';
import { testCapsuleSphere } from './capsuleTests';
import type { SphereHitbox } from '../../hitbox/SphereHitbox';
import type { CubeHitbox } from '../../hitbox/CubeHitbox';
import type { CapsuleHitbox } from '../../hitbox/CapsuleHitbox';
import type { MeshHitbox } from '../../hitbox/MeshHitbox';

/** @internal */
export function testSphereSphere(a: SphereHitbox, b: SphereHitbox): CollisionResult {
  const delta: Vec3 = [a.worldCenter[0] - b.worldCenter[0], a.worldCenter[1] - b.worldCenter[1], a.worldCenter[2] - b.worldCenter[2]];
  const squaredDist = dot(delta, delta);
  const radiusSum = a.radius + b.radius;
  if (squaredDist >= radiusSum * radiusSum) return NO_HIT;
  const distance = Math.sqrt(squaredDist);
  return { hit: true, depth: radiusSum - distance, normal: safeNorm3(delta) };
}

/** @internal */
export function testSphereCube(sphere: SphereHitbox, cube: CubeHitbox): CollisionResult {
  return pointRadiusVsOBB(sphere.worldCenter, sphere.radius, cube);
}

/** @internal */
export function testSphereCapsule(sphere: SphereHitbox, capsule: CapsuleHitbox): CollisionResult {
  return flipNormal(testCapsuleSphere(capsule, sphere));
}

/** @internal */
export function testSphereMesh(sphere: SphereHitbox, mesh: MeshHitbox): CollisionResult {
  return pointRadiusVsAABB(sphere.worldCenter, sphere.radius, mesh);
}
