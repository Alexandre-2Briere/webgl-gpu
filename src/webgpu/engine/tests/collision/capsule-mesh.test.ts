import { describe, it, expect } from 'vitest';
import { testCapsuleMesh } from '../../gameObject/rigidbody/narrowPhaseHelper/capsuleTests';
import { CapsuleHitbox } from '../../gameObject/hitbox/CapsuleHitbox';
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeCapsule(radius: number, height: number, position: [number, number, number] = [0, 0, 0]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(radius, height);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

function makeBox(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-halfExtents[0], -halfExtents[1], -halfExtents[2]],
    max: [halfExtents[0], halfExtents[1], halfExtents[2]],
  });
  mesh.updateOrientation(position, IDENTITY);
  return mesh;
}

describe('testCapsuleMesh', () => {
  it('capsule endpoint inside AABB is a hit', () => {
    // Capsule at origin, height=4, radius=0.5 → segment from Y=-1.5 to Y=1.5
    // AABB extends ±2 → endpoint Y=1.5 is inside
    const result = testCapsuleMesh(makeCapsule(0.5, 4, [0, 0, 0]), makeBox([2, 2, 2]));
    expect(result.hit).toBe(true);
  });

  it('capsule shaft intersecting AABB face is a hit', () => {
    // Capsule at [1.8,0,0] radius=1: closest segment point to AABB center → inside
    const result = testCapsuleMesh(makeCapsule(1, 4, [1.8, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(true);
  });

  it('capsule entirely outside AABB is not a hit', () => {
    const result = testCapsuleMesh(makeCapsule(0.5, 2, [10, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(false);
  });

  it('degenerate capsule (height=0) at AABB center is a hit', () => {
    const result = testCapsuleMesh(makeCapsule(0.5, 0, [0, 0, 0]), makeBox([1, 1, 1]));
    expect(result.hit).toBe(true);
  });

  it('depth is positive when hit', () => {
    const result = testCapsuleMesh(makeCapsule(0.5, 4, [0, 0, 0]), makeBox([2, 2, 2]));
    expect(result.depth).toBeGreaterThan(0);
  });
});
