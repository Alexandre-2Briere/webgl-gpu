import { describe, it, expect } from 'vitest';
import { testPlaneCapsule } from '../../gameObject/rigidbody/narrowPhaseHelper/planeTests';
import { PlaneHitbox } from '../../gameObject/hitbox/PlaneHitbox';
import { CapsuleHitbox } from '../../gameObject/hitbox/CapsuleHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makePlane(axis: 'x' | 'y' | 'z', offset: number): PlaneHitbox {
  const plane = new PlaneHitbox(axis);
  const pos: [number, number, number] =
    axis === 'x' ? [offset, 0, 0] : axis === 'y' ? [0, offset, 0] : [0, 0, offset];
  plane.updateOrientation(pos, IDENTITY);
  return plane;
}

function makeCapsule(radius: number, height: number, position: [number, number, number]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(radius, height);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

describe('testPlaneCapsule — vertical capsule, y-axis plane at y=0', () => {
  it('capsule just touching plane: hit', () => {
    // height=2, radius=0.5 → half-height=1, up-extent along Y=1, support=1+0.5=1.5
    // center at y=1 → signedDist=1, absDist=1 ≤ support=1.5 → hit, depth=0.5
    const result = testPlaneCapsule(makePlane('y', 0), makeCapsule(0.5, 2, [0, 1, 0]));
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.5);
    expect(result.normal[1]).toBeGreaterThan(0);
  });

  it('capsule center on plane: hit', () => {
    const result = testPlaneCapsule(makePlane('y', 0), makeCapsule(0.5, 2, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('capsule fully above plane: no hit', () => {
    // center y=10, support=1.5 → absDist=10 > 1.5
    const result = testPlaneCapsule(makePlane('y', 0), makeCapsule(0.5, 2, [0, 10, 0]));
    expect(result.hit).toBe(false);
  });

  it('capsule below plane, overlapping: hit with downward normal', () => {
    const result = testPlaneCapsule(makePlane('y', 0), makeCapsule(0.5, 2, [0, -1, 0]));
    expect(result.hit).toBe(true);
    expect(result.normal[1]).toBeLessThan(0);
  });
});
