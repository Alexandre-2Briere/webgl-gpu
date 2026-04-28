import { describe, it, expect } from 'vitest';
import { SphereHitbox } from '../../gameObject/3D/hitbox/SphereHitbox';

describe('SphereHitbox — construction', () => {
  it('stores the radius passed to the constructor', () => {
    expect(new SphereHitbox(3).radius).toBe(3);
  });

  it('type is "sphere"', () => {
    expect(new SphereHitbox(1).type).toBe('sphere');
  });

  it('offsetTranslation defaults to [0,0,0] when omitted', () => {
    expect(new SphereHitbox(1).offsetTranslation).toEqual([0, 0, 0]);
  });

  it('offsetRotation defaults to [0,0] when omitted', () => {
    expect(new SphereHitbox(1).offsetRotation).toEqual([0, 0]);
  });

  it('stores a provided offsetTranslation', () => {
    expect(new SphereHitbox(1, [1, 2, 3]).offsetTranslation).toEqual([1, 2, 3]);
  });

  it('stores a provided offsetRotation', () => {
    expect(new SphereHitbox(1, undefined, [0.5, 1.0]).offsetRotation).toEqual([0.5, 1.0]);
  });

  it('radius of 0 is stored as-is (degenerate point-like sphere)', () => {
    expect(new SphereHitbox(0).radius).toBe(0);
  });

  it('negative radius is stored as-is (no clamping at construction)', () => {
    expect(new SphereHitbox(-5).radius).toBe(-5);
  });
});

describe('SphereHitbox — initial world center', () => {
  it('worldCenter before any orientation update is [0,0,0]', () => {
    const sphere = new SphereHitbox(1);
    expect(sphere.worldCenter).toEqual([0, 0, 0]);
  });
});

describe('SphereHitbox — clone', () => {
  it('clone returns a new SphereHitbox with the same radius', () => {
    const original = new SphereHitbox(5);
    const cloned = original.clone();
    expect(cloned.radius).toBe(5);
  });

  it('clone returns a different object instance', () => {
    const original = new SphereHitbox(5);
    expect(original.clone()).not.toBe(original);
  });

  it('mutating clone radius does not affect the original', () => {
    const original = new SphereHitbox(5);
    const cloned = original.clone();
    cloned.radius = 99;
    expect(original.radius).toBe(5);
  });

  it('clone preserves offsetTranslation', () => {
    const original = new SphereHitbox(1, [2, 3, 4]);
    expect(original.clone().offsetTranslation).toEqual([2, 3, 4]);
  });

  it('clone preserves offsetRotation', () => {
    const original = new SphereHitbox(1, undefined, [0.1, 0.2]);
    expect(original.clone().offsetRotation).toEqual([0.1, 0.2]);
  });

  it('mutating clone offsetTranslation does not affect the original', () => {
    const original = new SphereHitbox(1, [1, 0, 0]);
    const cloned = original.clone();
    cloned.offsetTranslation[0] = 99;
    expect(original.offsetTranslation[0]).toBe(1);
  });
});
