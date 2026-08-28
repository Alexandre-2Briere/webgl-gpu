import { describe, it, expect } from 'vitest';
import { aabbOverlap, type AABB } from '../../gameObject/3D/rigidbody/broadPhase';

function aabb(min: [number, number, number], max: [number, number, number]): AABB {
  return { min, max };
}

describe('aabbOverlap', () => {
  it('clearly overlapping AABBs returns true', () => {
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([0, 0, 0], [2, 2, 2]))).toBe(true);
  });

  it('same AABB compared with itself returns true', () => {
    const box = aabb([-1, -1, -1], [1, 1, 1]);
    expect(aabbOverlap(box, box)).toBe(true);
  });

  it('one AABB fully inside the other returns true', () => {
    expect(aabbOverlap(aabb([-5, -5, -5], [5, 5, 5]), aabb([-1, -1, -1], [1, 1, 1]))).toBe(true);
  });

  it('clearly separated on X axis returns false', () => {
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([3, -1, -1], [5, 1, 1]))).toBe(false);
  });

  it('clearly separated on Y axis returns false', () => {
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([-1, 3, -1], [1, 5, 1]))).toBe(false);
  });

  it('clearly separated on Z axis returns false', () => {
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([-1, -1, 3], [1, 1, 5]))).toBe(false);
  });

  it('touching exactly on shared face returns false (strict inequality)', () => {
    // a.max[0] === b.min[0]: the test is a.max > b.min, so equal → false
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([1, -1, -1], [3, 1, 1]))).toBe(false);
  });

  it('zero-volume AABB (point) inside another AABB returns true', () => {
    expect(aabbOverlap(aabb([-5, -5, -5], [5, 5, 5]), aabb([0, 0, 0], [0, 0, 0]))).toBe(true);
  });

  it('zero-volume AABB (point) outside another AABB returns false', () => {
    expect(aabbOverlap(aabb([-1, -1, -1], [1, 1, 1]), aabb([3, 3, 3], [3, 3, 3]))).toBe(false);
  });

  it('overlapping only on X and Y but separated on Z returns false', () => {
    expect(aabbOverlap(aabb([0, 0, 0], [2, 2, 2]), aabb([1, 1, 3], [3, 3, 5]))).toBe(false);
  });
});
