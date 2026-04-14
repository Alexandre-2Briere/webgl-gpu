import { describe, it, expect } from 'vitest';
import { testPlaneMesh } from '../../gameObject/rigidbody/narrowPhaseHelper/planeTests';
import { PlaneHitbox } from '../../gameObject/hitbox/PlaneHitbox';
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makePlane(axis: 'x' | 'y' | 'z', offset: number): PlaneHitbox {
  const plane = new PlaneHitbox(axis);
  const pos: [number, number, number] =
    axis === 'x' ? [offset, 0, 0] : axis === 'y' ? [0, offset, 0] : [0, 0, offset];
  plane.updateOrientation(pos, IDENTITY);
  return plane;
}

function makeMesh(
  halfExtents: [number, number, number],
  position: [number, number, number],
): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-halfExtents[0], -halfExtents[1], -halfExtents[2]],
    max: [ halfExtents[0],  halfExtents[1],  halfExtents[2]],
  });
  mesh.updateOrientation(position, IDENTITY);
  return mesh;
}

describe('testPlaneMesh — y-axis plane at y=0', () => {
  it('mesh straddling plane: hit', () => {
    // center y=0.5, halfExtent y=1 → bottom at y=-0.5, overlaps plane
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, 0.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
  });

  it('mesh center on plane: hit, depth=halfExtent', () => {
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(1);
  });

  it('mesh entirely above plane: no hit', () => {
    // center y=5, halfExtent y=1 → bottom at y=4 → above plane
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, 5, 0]));
    expect(result.hit).toBe(false);
  });

  it('mesh entirely below plane: no hit', () => {
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, -5, 0]));
    expect(result.hit).toBe(false);
  });

  it('normal points upward when mesh is above plane', () => {
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, 0.5, 0]));
    expect(result.normal[1]).toBeGreaterThan(0);
  });

  it('normal points downward when mesh is below plane', () => {
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([1, 1, 1], [0, -0.5, 0]));
    expect(result.normal[1]).toBeLessThan(0);
  });

  it('asymmetric halfExtents: uses the y half-extent for support', () => {
    // halfExtent y=0.3, center y=0.2 → absDist=0.2 ≤ support=0.3 → hit, depth=0.1
    const result = testPlaneMesh(makePlane('y', 0), makeMesh([2, 0.3, 2], [0, 0.2, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.1);
  });
});

describe('testPlaneMesh — x-axis plane', () => {
  it('mesh straddling x-axis plane: hit with rightward normal', () => {
    const result = testPlaneMesh(makePlane('x', 0), makeMesh([1, 1, 1], [0.5, 0, 0]));
    expect(result.hit).toBe(true);
    expect(result.normal[0]).toBeGreaterThan(0);
  });
});

describe('testPlaneMesh — non-zero plane offset', () => {
  it('plane at y=3, mesh center y=3.5, halfExtent y=1: hit', () => {
    const result = testPlaneMesh(makePlane('y', 3), makeMesh([1, 1, 1], [0, 3.5, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
  });

  it('plane at y=3, mesh center y=6, halfExtent y=1: no hit', () => {
    const result = testPlaneMesh(makePlane('y', 3), makeMesh([1, 1, 1], [0, 6, 0]));
    expect(result.hit).toBe(false);
  });
});
