import type { Hitbox3D, SphereHitbox, CubeHitbox, CapsuleHitbox, MeshHitbox } from '../hitbox';
import { type CollisionResult, NO_HIT } from './narrowPhaseHelper/helpers';
import { testSphereSphere, testSphereCube, testSphereCapsule, testSphereMesh } from './narrowPhaseHelper/sphereTests';
import { testCubeCube, testCubeSphere, testCubeCapsule, testCubeMesh } from './narrowPhaseHelper/cubeTests';
import { testCapsuleSphere, testCapsuleCube, testCapsuleCapsule, testCapsuleMesh } from './narrowPhaseHelper/capsuleTests';
import { testMeshMesh, testMeshCube, testMeshCapsule, testMeshSphere } from './narrowPhaseHelper/meshTests';

/** @internal */ export type { CollisionResult };

/** @internal */
export function narrowPhase(a: Hitbox3D, b: Hitbox3D): CollisionResult {
  const typeA = a.type;
  const typeB = b.type;

  if (typeA === 'sphere') {
    const sa = a as SphereHitbox;
    if (typeB === 'sphere')  return testSphereSphere(sa, b as SphereHitbox);
    if (typeB === 'cube')    return testSphereCube(sa, b as CubeHitbox);
    if (typeB === 'capsule') return testSphereCapsule(sa, b as CapsuleHitbox);
    if (typeB === 'mesh')    return testSphereMesh(sa, b as MeshHitbox);
  }

  if (typeA === 'cube') {
    const ca = a as CubeHitbox;
    if (typeB === 'sphere')  return testCubeSphere(ca, b as SphereHitbox);
    if (typeB === 'cube')    return testCubeCube(ca, b as CubeHitbox);
    if (typeB === 'capsule') return testCubeCapsule(ca, b as CapsuleHitbox);
    if (typeB === 'mesh')    return testCubeMesh(ca, b as MeshHitbox);
  }

  if (typeA === 'capsule') {
    const ca = a as CapsuleHitbox;
    if (typeB === 'sphere')  return testCapsuleSphere(ca, b as SphereHitbox);
    if (typeB === 'cube')    return testCapsuleCube(ca, b as CubeHitbox);
    if (typeB === 'capsule') return testCapsuleCapsule(ca, b as CapsuleHitbox);
    if (typeB === 'mesh')    return testCapsuleMesh(ca, b as MeshHitbox);
  }

  if (typeA === 'mesh') {
    const ma = a as MeshHitbox;
    if (typeB === 'sphere')  return testMeshSphere(ma, b as SphereHitbox);
    if (typeB === 'cube')    return testMeshCube(ma, b as CubeHitbox);
    if (typeB === 'capsule') return testMeshCapsule(ma, b as CapsuleHitbox);
    if (typeB === 'mesh')    return testMeshMesh(ma, b as MeshHitbox);
  }

  return NO_HIT;
}
