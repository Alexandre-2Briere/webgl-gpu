import { describe, it, expect } from 'vitest';
import { testCubeCube } from '../../gameObject/rigidbody/narrowPhaseHelper/cubeTests';
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox';
import { yawPitchRollToQuat } from '../../math/quat';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

function makeCube(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0], quaternion = IDENTITY): CubeHitbox {
  const cube = new CubeHitbox(halfExtents);
  cube.updateOrientation(position, quaternion);
  return cube;
}

describe('testCubeCube', () => {
  it('two axis-aligned cubes at the same position are a hit', () => {
    const result = testCubeCube(makeCube([1, 1, 1]), makeCube([1, 1, 1]));
    expect(result.hit).toBe(true);
  });

  it('two axis-aligned cubes clearly overlapping on X are a hit', () => {
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [1.5, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('depth is the penetration amount on the minimal axis', () => {
    // Overlap = (1+1) - 1.5 = 0.5
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [1.5, 0, 0]));
    expect(result.depth).toBeCloseTo(0.5, 4);
  });

  it('two axis-aligned cubes touching face-to-face return no hit (strict check)', () => {
    // centers 2 apart, halfExtents sum = 2: touching exactly → overlap=0 → no hit
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [2, 0, 0]));
    expect(result.hit).toBe(false);
  });

  it('two axis-aligned cubes clearly apart are not a hit', () => {
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [5, 0, 0]));
    expect(result.hit).toBe(false);
  });

  it('two rotated OBBs at the same position are a hit', () => {
    const quat90 = yawPitchRollToQuat(Math.PI / 2, 0, 0);
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [0, 0, 0], quat90));
    expect(result.hit).toBe(true);
  });

  it('normal is a unit vector when hit', () => {
    const result = testCubeCube(makeCube([1, 1, 1], [0, 0, 0]), makeCube([1, 1, 1], [1.5, 0, 0]));
    const length = Math.sqrt(result.normal[0] ** 2 + result.normal[1] ** 2 + result.normal[2] ** 2);
    expect(length).toBeCloseTo(1, 3);
  });

  it('zero-size cube vs normal cube at same position does not throw', () => {
    expect(() => testCubeCube(makeCube([0, 0, 0]), makeCube([1, 1, 1]))).not.toThrow();
  });
});
