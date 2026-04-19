import { describe, it, expect } from 'vitest';
import { testPlaneCube } from '../../gameObject/rigidbody/narrowPhaseHelper/planeTests';
import { PlaneHitbox } from '../../gameObject/hitbox/PlaneHitbox';
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makePlane(axis: 'x' | 'y' | 'z', offset: number): PlaneHitbox {
  const plane = new PlaneHitbox(axis);
  const pos: [number, number, number] =
    axis === 'x' ? [offset, 0, 0] : axis === 'y' ? [0, offset, 0] : [0, 0, offset];
  plane.updateOrientation(pos, IDENTITY);
  return plane;
}

function makeCube(halfExtents: [number, number, number], position: [number, number, number]): CubeHitbox {
  const cube = new CubeHitbox(halfExtents);
  cube.updateOrientation(position, IDENTITY);
  return cube;
}

describe('testPlaneCube — y-axis plane at y=0', () => {
  it('axis-aligned cube straddling plane: hit', () => {
    // cube center at y=0.5, halfExtent y=1 → bottom at y=-0.5, overlaps plane
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, 0.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
  });

  it('cube exactly on plane (center at y=0): hit, depth=halfExtent', () => {
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(1);
  });

  it('cube entirely above plane: no hit', () => {
    // center y=5, halfExtent y=1 → bottom at y=4 → above plane
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, 5, 0]));
    expect(result.hit).toBe(false);
  });

  it('cube entirely below plane: no hit', () => {
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, -5, 0]));
    expect(result.hit).toBe(false);
  });

  it('normal points toward plane (downward when cube is above)', () => {
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, 0.5, 0]));
    expect(result.normal[1]).toBeLessThan(0);
  });

  it('normal points upward when cube is below the plane', () => {
    const result = testPlaneCube(makePlane('y', 0), makeCube([1, 1, 1], [0, -0.5, 0]));
    expect(result.normal[1]).toBeGreaterThan(0);
  });
});

describe('testPlaneCube — x-axis plane', () => {
  it('cube straddling x-axis plane: hit', () => {
    const result = testPlaneCube(makePlane('x', 0), makeCube([1, 1, 1], [0.5, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.normal[0]).toBeLessThan(0);
  });
});
