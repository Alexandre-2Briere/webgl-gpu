import { describe, it, expect } from 'vitest'
import { testSphereSphere } from '../../gameObject/rigidbody/narrowPhaseHelper/sphereTests'
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function makeSphere(radius: number, position: [number, number, number] = [0, 0, 0]): SphereHitbox {
  const sphere = new SphereHitbox(radius)
  sphere.updateOrientation(position, IDENTITY)
  return sphere
}

describe('testSphereSphere', () => {
  it('two overlapping spheres (radii 1, distance 1.5) produce a hit', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [1.5, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('penetration depth is approximately radiusSum - distance', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [1.5, 0, 0]))
    expect(result.depth).toBeCloseTo(0.5, 4)
  })

  it('normal points from B toward A (along separation axis)', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [1.5, 0, 0]))
    expect(result.normal[0]).toBeLessThan(0) // A is at 0, B is at +1.5 → normal from B to A is -X
  })

  it('two non-overlapping spheres (distance > radiusSum) produce no hit', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [2.1, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('two spheres exactly touching (distance = radiusSum) produce no hit (strict check)', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [2, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('two spheres at the same position produce a hit with depth equal to radiusSum', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [0, 0, 0]))
    expect(result.hit).toBe(true)
    expect(result.depth).toBeCloseTo(2, 4)
  })

  it('radius=0 sphere inside a radius=1 sphere produces a hit', () => {
    const result = testSphereSphere(makeSphere(0, [0, 0, 0]), makeSphere(1, [0.5, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('both radius=0 at same position: no hit (distance=0 equals radiusSum=0, strict >= check)', () => {
    const result = testSphereSphere(makeSphere(0, [0, 0, 0]), makeSphere(0, [0, 0, 0]))
    // squaredDist = 0, radiusSum = 0, 0 >= 0 is true → NO_HIT
    expect(result.hit).toBe(false)
  })

  it('result normal is a unit vector when spheres overlap at offset', () => {
    const result = testSphereSphere(makeSphere(1, [0, 0, 0]), makeSphere(1, [1.5, 0, 0]))
    const length = Math.sqrt(result.normal[0] ** 2 + result.normal[1] ** 2 + result.normal[2] ** 2)
    expect(length).toBeCloseTo(1, 2)
  })
})
