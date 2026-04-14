import { describe, it, expect } from 'vitest';
import { PlaneHitbox } from '../../gameObject/hitbox/PlaneHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

describe('PlaneHitbox — type and axis', () => {
  it('type is "plane"', () => {
    expect(new PlaneHitbox('y').type).toBe('plane');
  });

  it('default axis is "y"', () => {
    expect(new PlaneHitbox().axis).toBe('y');
  });

  it('accepts "x" axis', () => {
    expect(new PlaneHitbox('x').axis).toBe('x');
  });

  it('accepts "z" axis', () => {
    expect(new PlaneHitbox('z').axis).toBe('z');
  });
});

describe('PlaneHitbox — normal', () => {
  it('y-axis plane normal is [0,1,0]', () => {
    expect(new PlaneHitbox('y').normal).toEqual([0, 1, 0]);
  });
  it('x-axis plane normal is [1,0,0]', () => {
    expect(new PlaneHitbox('x').normal).toEqual([1, 0, 0]);
  });
  it('z-axis plane normal is [0,0,1]', () => {
    expect(new PlaneHitbox('z').normal).toEqual([0, 0, 1]);
  });
});

describe('PlaneHitbox — planeOffset', () => {
  it('y-axis plane at y=5 has planeOffset=5', () => {
    const plane = new PlaneHitbox('y');
    plane.updateOrientation([0, 5, 0], IDENTITY);
    expect(plane.planeOffset).toBeCloseTo(5);
  });

  it('x-axis plane at x=-3 has planeOffset=-3', () => {
    const plane = new PlaneHitbox('x');
    plane.updateOrientation([-3, 0, 0], IDENTITY);
    expect(plane.planeOffset).toBeCloseTo(-3);
  });

  it('z-axis plane at z=10 has planeOffset=10', () => {
    const plane = new PlaneHitbox('z');
    plane.updateOrientation([0, 0, 10], IDENTITY);
    expect(plane.planeOffset).toBeCloseTo(10);
  });

  it('planeOffset=0 at origin', () => {
    const plane = new PlaneHitbox('y');
    plane.updateOrientation([0, 0, 0], IDENTITY);
    expect(plane.planeOffset).toBeCloseTo(0);
  });
});

describe('PlaneHitbox — clone', () => {
  it('clone produces an independent copy with same axis', () => {
    const original = new PlaneHitbox('x');
    original.updateOrientation([2, 0, 0], IDENTITY);
    const copy = original.clone();
    expect(copy.axis).toBe('x');
    expect(copy.planeOffset).toBeCloseTo(2);
  });

  it('mutating clone does not affect original', () => {
    const original = new PlaneHitbox('y');
    original.updateOrientation([0, 1, 0], IDENTITY);
    const copy = original.clone();
    copy.updateOrientation([0, 99, 0], IDENTITY);
    expect(original.planeOffset).toBeCloseTo(1);
    expect(copy.planeOffset).toBeCloseTo(99);
  });
});
