import { describe, it, expect } from 'vitest'
import { testSphereCube } from '../../gameObject/rigidbody/narrowPhaseHelper/sphereTests'
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox'
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function makeSphere(radius: number, position: [number, number, number] = [0, 0, 0]): SphereHitbox {
  const sphere = new SphereHitbox(radius)
  sphere.updateOrientation(position, IDENTITY)
  return sphere
}

function makeCube(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): CubeHitbox {
  const cube = new CubeHitbox(halfExtents)
  cube.updateOrientation(position, IDENTITY)
  return cube
}

describe('testSphereCube', () => {
  it('sphere center inside cube is a hit', () => {
    const result = testSphereCube(makeSphere(0.5, [0, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('sphere center outside cube but radius reaches the cube face is a hit', () => {
    // sphere at [1.8,0,0] radius=1: closest point on cube face is [1,0,0], distance=0.8 < 1
    const result = testSphereCube(makeSphere(1, [1.8, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('sphere center outside cube with insufficient radius is not a hit', () => {
    // sphere at [2.5,0,0] radius=0.4: closest point is [1,0,0], distance=1.5 > 0.4 → no hit
    const result = testSphereCube(makeSphere(0.4, [2.5, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('sphere clearly away from cube on all axes is not a hit', () => {
    const result = testSphereCube(makeSphere(0.5, [10, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('sphere radius=0 at cube center (point-inside-OBB) is a hit', () => {
    const result = testSphereCube(makeSphere(0, [0, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('depth is positive when hit', () => {
    const result = testSphereCube(makeSphere(0.5, [0, 0, 0]), makeCube([1, 1, 1], [0, 0, 0]))
    expect(result.depth).toBeGreaterThan(0)
  })

  it('zero-size cube with sphere centered on it is a hit', () => {
    const result = testSphereCube(makeSphere(1, [0, 0, 0]), makeCube([0, 0, 0], [0, 0, 0]))
    expect(result.hit).toBe(true)
  })
})
