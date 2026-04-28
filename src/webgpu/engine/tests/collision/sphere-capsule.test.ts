import { describe, it, expect } from 'vitest';
import { testSphereCapsule } from '../../gameObject/3D/rigidbody/narrowPhaseHelper/sphereTests';
import { SphereHitbox } from '../../gameObject/3D/hitbox/SphereHitbox';
import { CapsuleHitbox } from '../../gameObject/3D/hitbox/CapsuleHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeSphere(radius: number, position: [number, number, number] = [0, 0, 0]): SphereHitbox {
  const sphere = new SphereHitbox(radius);
  sphere.updateOrientation(position, IDENTITY);
  return sphere;
}

function makeCapsule(radius: number, height: number, position: [number, number, number] = [0, 0, 0]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(radius, height);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

describe('testSphereCapsule', () => {
  it('sphere overlapping the capsule body (shaft) is a hit', () => {
    // Capsule at origin, height=4, radius=1 → shaft from Y=-1 to Y=1
    // Sphere at [1.8, 0, 0] radius=1: distance to shaft ≈ 0.8 < 1+1=2 → hit
    const result = testSphereCapsule(makeSphere(1, [1.8, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('sphere overlapping one hemisphere end of the capsule is a hit', () => {
    // Capsule shaft top is at Y=1; capsule radius=1; total reach Y=1+1=2
    // Sphere at [0, 2.8, 0] radius=1: distance from sphere to top segment endpoint ≈ 1.8 < 2
    const result = testSphereCapsule(makeSphere(1, [0, 2.8, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('sphere clearly away from the capsule is not a hit', () => {
    const result = testSphereCapsule(makeSphere(0.5, [10, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.hit).toBe(false);
  });

  it('degenerate capsule (height=0 radius=1) acts like a sphere, overlapping sphere is a hit', () => {
    const result = testSphereCapsule(makeSphere(1, [1.5, 0, 0]), makeCapsule(1, 0, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('depth is positive when hit', () => {
    const result = testSphereCapsule(makeSphere(1, [1.5, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.depth).toBeGreaterThan(0);
  });

  it('normal is a unit vector when hit', () => {
    const result = testSphereCapsule(makeSphere(1, [1.5, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    if (result.hit) {
      const length = Math.sqrt(result.normal[0] ** 2 + result.normal[1] ** 2 + result.normal[2] ** 2);
      expect(length).toBeCloseTo(1, 2);
    }
  });
});
