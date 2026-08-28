import { describe, it, expect } from 'vitest';
import { CubeHitbox } from '../../gameObject/3D/hitbox/CubeHitbox';

describe('CubeHitbox — construction', () => {
  it('stores the halfExtents passed to the constructor', () => {
    const cube = new CubeHitbox([1, 2, 3]);
    expect(cube.halfExtents).toEqual([1, 2, 3]);
  });

  it('type is "cube"', () => {
    expect(new CubeHitbox([1, 1, 1]).type).toBe('cube');
  });

  it('offsetTranslation defaults to [0,0,0] when omitted', () => {
    expect(new CubeHitbox([1, 1, 1]).offsetTranslation).toEqual([0, 0, 0]);
  });

  it('offsetRotation defaults to [0,0] when omitted', () => {
    expect(new CubeHitbox([1, 1, 1]).offsetRotation).toEqual([0, 0]);
  });

  it('stores a provided offsetTranslation', () => {
    const cube = new CubeHitbox([1, 1, 1], [5, 0, -1]);
    expect(cube.offsetTranslation).toEqual([5, 0, -1]);
  });

  it('zero halfExtents [0,0,0] construction succeeds (degenerate point-like box)', () => {
    const cube = new CubeHitbox([0, 0, 0]);
    expect(cube.halfExtents).toEqual([0, 0, 0]);
  });

  it('negative halfExtents are stored as-is (no clamping at construction)', () => {
    const cube = new CubeHitbox([-1, -2, -3]);
    expect(cube.halfExtents).toEqual([-1, -2, -3]);
  });
});

describe('CubeHitbox — initial world center', () => {
  it('worldCenter before any orientation update is [0,0,0]', () => {
    expect(new CubeHitbox([1, 1, 1]).worldCenter).toEqual([0, 0, 0]);
  });
});

describe('CubeHitbox — clone', () => {
  it('clone returns a new CubeHitbox with the same halfExtents', () => {
    const original = new CubeHitbox([2, 3, 4]);
    expect(original.clone().halfExtents).toEqual([2, 3, 4]);
  });

  it('clone returns a different object instance', () => {
    const original = new CubeHitbox([1, 1, 1]);
    expect(original.clone()).not.toBe(original);
  });

  it('mutating clone halfExtents does not affect the original', () => {
    const original = new CubeHitbox([1, 2, 3]);
    const cloned = original.clone();
    cloned.halfExtents[0] = 99;
    expect(original.halfExtents[0]).toBe(1);
  });

  it('clone preserves offsetTranslation', () => {
    const original = new CubeHitbox([1, 1, 1], [3, 0, 1]);
    expect(original.clone().offsetTranslation).toEqual([3, 0, 1]);
  });

  it('mutating clone offsetTranslation does not affect the original', () => {
    const original = new CubeHitbox([1, 1, 1], [1, 2, 3]);
    const cloned = original.clone();
    cloned.offsetTranslation[0] = 99;
    expect(original.offsetTranslation[0]).toBe(1);
  });
});
