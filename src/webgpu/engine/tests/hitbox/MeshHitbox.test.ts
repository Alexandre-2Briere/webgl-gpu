import { describe, it, expect } from 'vitest';
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox';

describe('MeshHitbox — AABB computed from vertices', () => {
  it('type is "mesh"', () => {
    expect(new MeshHitbox(new Float32Array([0, 0, 0])).type).toBe('mesh');
  });

  it('computes localMin and localMax from a simple triangle', () => {
    // Three vertices: (1,0,0), (-1,0,0), (0,2,0) — stride 3
    const vertices = new Float32Array([1, 0, 0,  -1, 0, 0,  0, 2, 0]);
    const mesh = new MeshHitbox(vertices);
    expect(mesh.localMin).toEqual([-1, 0, 0]);
    expect(mesh.localMax).toEqual([1, 2, 0]);
  });

  it('derives halfExtents from localMin/localMax', () => {
    const vertices = new Float32Array([1, 0, 0,  -1, 0, 0,  0, 2, 0]);
    const mesh = new MeshHitbox(vertices);
    expect(mesh.halfExtents).toEqual([1, 1, 0]);
  });

  it('reads positions with a custom stride (skips non-position data)', () => {
    // stride=6: [x,y,z, nx,ny,nz] — positions at offset 0,1,2
    const vertices = new Float32Array([
      2, 0, 0,  0, 0, 1,   // pos (2,0,0), normal (0,0,1)
      -2, 0, 0, 0, 0, 1,   // pos (-2,0,0)
      0, 4, 0,  0, 1, 0,   // pos (0,4,0)
    ]);
    const mesh = new MeshHitbox(vertices, 6);
    expect(mesh.localMin[0]).toBeCloseTo(-2, 5);
    expect(mesh.localMax[0]).toBeCloseTo(2, 5);
    expect(mesh.localMax[1]).toBeCloseTo(4, 5);
  });

  it('uses override min/max when provided, ignoring vertices', () => {
    const vertices = new Float32Array([100, 100, 100]); // would produce wrong bounds
    const mesh = new MeshHitbox(vertices, 3, undefined, undefined, {
      min: [-5, -5, -5],
      max: [5, 5, 5],
    });
    expect(mesh.localMin).toEqual([-5, -5, -5]);
    expect(mesh.localMax).toEqual([5, 5, 5]);
    expect(mesh.halfExtents).toEqual([5, 5, 5]);
  });

  it('single vertex produces localMin === localMax and halfExtents of [0,0,0]', () => {
    const mesh = new MeshHitbox(new Float32Array([3, 7, -2]));
    expect(mesh.localMin).toEqual([3, 7, -2]);
    expect(mesh.localMax).toEqual([3, 7, -2]);
    expect(mesh.halfExtents).toEqual([0, 0, 0]);
  });

  it('handles negative coordinate vertices correctly', () => {
    const vertices = new Float32Array([-5, -5, -5,  5, 5, 5]);
    const mesh = new MeshHitbox(vertices);
    expect(mesh.localMin).toEqual([-5, -5, -5]);
    expect(mesh.localMax).toEqual([5, 5, 5]);
    expect(mesh.halfExtents).toEqual([5, 5, 5]);
  });

  it('all vertices at the same point produces zero halfExtents', () => {
    const vertices = new Float32Array([1, 1, 1,  1, 1, 1,  1, 1, 1]);
    const mesh = new MeshHitbox(vertices);
    expect(mesh.halfExtents).toEqual([0, 0, 0]);
  });

  it('empty vertex array does not throw', () => {
    expect(() => new MeshHitbox(new Float32Array(0))).not.toThrow();
  });

  it('offsetTranslation defaults to [0,0,0]', () => {
    expect(new MeshHitbox(new Float32Array([0, 0, 0])).offsetTranslation).toEqual([0, 0, 0]);
  });
});

describe('MeshHitbox — initial world center', () => {
  it('worldCenter before any orientation update is [0,0,0]', () => {
    const mesh = new MeshHitbox(new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0]));
    expect(mesh.worldCenter).toEqual([0, 0, 0]);
  });
});

describe('MeshHitbox — clone', () => {
  it('clone returns a new MeshHitbox with the same localMin and localMax', () => {
    const vertices = new Float32Array([1, 0, 0, -1, 2, -3]);
    const original = new MeshHitbox(vertices);
    const cloned = original.clone();
    expect(cloned.localMin).toEqual(original.localMin);
    expect(cloned.localMax).toEqual(original.localMax);
  });

  it('clone returns a different object instance', () => {
    const original = new MeshHitbox(new Float32Array([1, 0, 0, -1, 0, 0]));
    expect(original.clone()).not.toBe(original);
  });

  it('mutating clone localMin does not affect the original', () => {
    const original = new MeshHitbox(new Float32Array([-1, 0, 0, 1, 0, 0]));
    const cloned = original.clone();
    cloned.localMin[0] = 99;
    expect(original.localMin[0]).toBe(-1);
  });

  it('clone preserves halfExtents', () => {
    const original = new MeshHitbox(new Float32Array([-2, 0, 0, 2, 0, 0]));
    const cloned = original.clone();
    expect(cloned.halfExtents[0]).toBeCloseTo(2, 5);
  });
});
