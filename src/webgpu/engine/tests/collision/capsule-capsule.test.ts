import { describe, it, expect } from 'vitest';
import { testCapsuleCapsule } from '../../gameObject/3D/rigidbody/narrowPhaseHelper/capsuleTests';
import { CapsuleHitbox } from '../../gameObject/3D/hitbox/CapsuleHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeCapsule(radius: number, height: number, position: [number, number, number] = [0, 0, 0]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(radius, height);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

describe('testCapsuleCapsule', () => {
  it('two parallel capsules at same position are a hit', () => {
    const result = testCapsuleCapsule(makeCapsule(1, 4, [0, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('two parallel capsules whose shafts overlap radially are a hit', () => {
    // Both vertical, centers 1.5 apart on X, radii sum = 2 → overlap
    const result = testCapsuleCapsule(makeCapsule(1, 4, [0, 0, 0]), makeCapsule(1, 4, [1.5, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('two parallel capsules far apart are not a hit', () => {
    const result = testCapsuleCapsule(makeCapsule(1, 4, [0, 0, 0]), makeCapsule(1, 4, [5, 0, 0]));
    expect(result.hit).toBe(false);
  });

  it('depth is radiusSum for capsules at same position (maximum overlap)', () => {
    const result = testCapsuleCapsule(makeCapsule(1, 4, [0, 0, 0]), makeCapsule(1, 4, [0, 0, 0]));
    expect(result.depth).toBeCloseTo(2, 4); // radiusSum = 2
  });

  it('both degenerate capsules (height ≤ 2×radius) at same position do not throw', () => {
    expect(() => testCapsuleCapsule(makeCapsule(2, 2, [0, 0, 0]), makeCapsule(2, 2, [0, 0, 0]))).not.toThrow();
  });

  it('two degenerate capsules (point-like) at same position: hit with depth = radiusSum', () => {
    const result = testCapsuleCapsule(makeCapsule(1, 0, [0, 0, 0]), makeCapsule(1, 0, [0, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(2, 4);
  });

  it('normal is a unit vector when hit', () => {
    const result = testCapsuleCapsule(makeCapsule(1, 4, [0, 0, 0]), makeCapsule(1, 4, [1.5, 0, 0]));
    if (result.hit) {
      const length = Math.sqrt(result.normal[0] ** 2 + result.normal[1] ** 2 + result.normal[2] ** 2);
      expect(length).toBeCloseTo(1, 2);
    }
  });
});
