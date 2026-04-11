import { describe, it, expect } from 'vitest';
import { testSphereMesh } from '../../gameObject/rigidbody/narrowPhaseHelper/sphereTests';
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox';
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeSphere(radius: number, position: [number, number, number] = [0, 0, 0]): SphereHitbox {
  const sphere = new SphereHitbox(radius);
  sphere.updateOrientation(position, IDENTITY);
  return sphere;
}

function makeBox(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-halfExtents[0], -halfExtents[1], -halfExtents[2]],
    max: [halfExtents[0], halfExtents[1], halfExtents[2]],
  });
  mesh.updateOrientation(position, IDENTITY);
  return mesh;
}

describe('testSphereMesh', () => {
  it('sphere center inside AABB is a hit', () => {
    const result = testSphereMesh(makeSphere(0.5, [0, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(true);
  });

  it('sphere radius bridging an AABB face is a hit', () => {
    // Sphere at [1.5,0,0] radius=0.6: distance to face=0.5 < radius → hit
    const result = testSphereMesh(makeSphere(0.6, [1.5, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(true);
  });

  it('sphere clearly outside AABB is not a hit', () => {
    const result = testSphereMesh(makeSphere(0.5, [10, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(false);
  });

  it('sphere radius too small to reach AABB face is not a hit', () => {
    const result = testSphereMesh(makeSphere(0.1, [2, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(false);
  });

  it('zero-size AABB with sphere centered on it is a hit', () => {
    const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
      min: [0, 0, 0], max: [0, 0, 0],
    });
    mesh.updateOrientation([0, 0, 0], IDENTITY);
    const result = testSphereMesh(makeSphere(1, [0, 0, 0]), mesh);
    expect(result.hit).toBe(true);
  });

  it('depth is positive when hit', () => {
    const result = testSphereMesh(makeSphere(0.5, [0, 0, 0]), makeBox([1, 1, 1]));
    expect(result.depth).toBeGreaterThan(0);
  });
});
