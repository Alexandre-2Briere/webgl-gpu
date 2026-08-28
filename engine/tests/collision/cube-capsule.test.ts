import { describe, it, expect } from 'vitest';
import { testCubeCapsule } from '../../gameObject/3D/rigidbody/narrowPhaseHelper/cubeTests';
import { CubeHitbox } from '../../gameObject/3D/hitbox/CubeHitbox';
import { CapsuleHitbox } from '../../gameObject/3D/hitbox/CapsuleHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeCube(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): CubeHitbox {
  const cube = new CubeHitbox(halfExtents);
  cube.updateOrientation(position, IDENTITY);
  return cube;
}

function makeCapsule(radius: number, height: number, position: [number, number, number] = [0, 0, 0]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(radius, height);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

describe('testCubeCapsule', () => {
  it('capsule endpoint inside cube is a hit', () => {
    // Capsule at [0,0,0] height=4 radius=0.5: endpoints at Y=±1.5; cube at origin extends ±2 → endpoint inside
    const result = testCubeCapsule(makeCube([2, 2, 2]), makeCapsule(0.5, 4, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('capsule body intersecting cube face is a hit', () => {
    // Capsule at [1.8, 0, 0] radius=1: closest segment point to cube center X → inside cube
    const result = testCubeCapsule(makeCube([1, 1, 1]), makeCapsule(1, 4, [1.8, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('capsule entirely outside cube is not a hit', () => {
    const result = testCubeCapsule(makeCube([1, 1, 1]), makeCapsule(0.5, 2, [10, 0, 0]));
    expect(result.hit).toBe(false);
  });

  it('degenerate capsule (height=0) at cube center is a hit', () => {
    const result = testCubeCapsule(makeCube([1, 1, 1]), makeCapsule(0.5, 0, [0, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('depth is positive when hit', () => {
    const result = testCubeCapsule(makeCube([2, 2, 2]), makeCapsule(0.5, 4, [0, 0, 0]));
    expect(result.depth).toBeGreaterThan(0);
  });
});
