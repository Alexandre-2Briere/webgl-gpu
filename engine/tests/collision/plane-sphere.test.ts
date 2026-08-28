import { describe, it, expect } from 'vitest';
import { testPlaneSphere } from '../../gameObject/3D/rigidbody/narrowPhaseHelper/planeTests';
import { PlaneHitbox } from '../../gameObject/3D/hitbox/PlaneHitbox';
import { SphereHitbox } from '../../gameObject/3D/hitbox/SphereHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makePlane(axis: 'x' | 'y' | 'z', offset: number): PlaneHitbox {
  const plane = new PlaneHitbox(axis);
  const pos: [number, number, number] =
    axis === 'x' ? [offset, 0, 0] : axis === 'y' ? [0, offset, 0] : [0, 0, offset];
  plane.updateOrientation(pos, IDENTITY);
  return plane;
}

function makeSphere(radius: number, position: [number, number, number]): SphereHitbox {
  const sphere = new SphereHitbox(radius);
  sphere.updateOrientation(position, IDENTITY);
  return sphere;
}

describe('testPlaneSphere — y-axis plane at y=0', () => {
  it('sphere center exactly on plane: hit, depth=radius', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(1, [0, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(1);
  });

  it('sphere above plane, overlapping: hit with downward normal', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(1, [0, 0.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
    expect(result.normal[1]).toBeLessThan(0);
  });

  it('sphere below plane, overlapping: hit with upward normal', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(1, [0, -0.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
    expect(result.normal[1]).toBeGreaterThan(0);
  });

  it('sphere clearly above plane (center > radius): no hit', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(1, [0, 5, 0]));
    expect(result.hit).toBe(false);
  });

  it('sphere clearly below plane (|center| > radius): no hit', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(0.5, [0, -3, 0]));
    expect(result.hit).toBe(false);
  });

  it('radius=0 sphere exactly on plane: hit with depth=0', () => {
    const result = testPlaneSphere(makePlane('y', 0), makeSphere(0, [0, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0);
  });
});

describe('testPlaneSphere — plane at non-zero offset', () => {
  it('plane at y=3, sphere at y=3.5, radius=1: hit', () => {
    const result = testPlaneSphere(makePlane('y', 3), makeSphere(1, [0, 3.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
  });

  it('plane at y=3, sphere at y=5, radius=1: no hit', () => {
    const result = testPlaneSphere(makePlane('y', 3), makeSphere(1, [0, 5, 0]));
    expect(result.hit).toBe(false);
  });
});

describe('testPlaneSphere — x-axis plane', () => {
  it('x-axis plane at x=0, sphere at x=0.5 radius=1: hit', () => {
    const result = testPlaneSphere(makePlane('x', 0), makeSphere(1, [0.5, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.normal[0]).toBeLessThan(0);
  });
});
