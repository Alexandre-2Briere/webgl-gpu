import { describe, it, expect } from 'vitest'
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox'
import { yawPitchRollToQuat } from '../../math/quat'
import type { Vec3, Vec4 } from '../../math/vec'

const IDENTITY_QUAT: Vec4 = [0, 0, 0, 1]

function expectVec3Close(actual: Vec3, expected: Vec3, precision = 4): void {
  for (let i = 0; i < 3; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], precision)
  }
}

// ── updateOrientation ─────────────────────────────────────────────────────────

describe('Hitbox3D.updateOrientation — world center placement', () => {
  it('places worldCenter at the given renderable position (no offset)', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([1, 2, 3], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [1, 2, 3])
  })

  it('places worldCenter at origin when position is [0,0,0]', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([0, 0, 0], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [0, 0, 0])
  })

  it('offset translation [0,5,0] shifts worldCenter by that amount in identity rotation', () => {
    const sphere = new SphereHitbox(1, [0, 5, 0])
    sphere.updateOrientation([0, 0, 0], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [0, 5, 0])
  })

  it('offset translation is combined with renderable position', () => {
    const sphere = new SphereHitbox(1, [1, 0, 0])
    sphere.updateOrientation([10, 0, 0], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [11, 0, 0])
  })
})

describe('Hitbox3D.updateOrientation — offset is in local space (rotated by quaternion)', () => {
  it('a [1,0,0] offset with 90° yaw rotation points in a different world direction', () => {
    const sphere = new SphereHitbox(1, [1, 0, 0])
    const yaw90 = yawPitchRollToQuat(Math.PI / 2, 0, 0)
    sphere.updateOrientation([0, 0, 0], yaw90)
    // Local [1,0,0] rotated by 90° yaw should no longer be world [1,0,0]
    // The rotated offset should have negligible X component
    expect(Math.abs(sphere.worldCenter[0])).toBeLessThan(0.01)
    // And should have a non-zero component on another axis
    const offsetMagnitude = Math.sqrt(
      sphere.worldCenter[0] ** 2 + sphere.worldCenter[1] ** 2 + sphere.worldCenter[2] ** 2
    )
    expect(offsetMagnitude).toBeCloseTo(1, 3)
  })
})

describe('Hitbox3D.updateOrientation — idempotency', () => {
  it('calling updateOrientation twice with different positions takes the last value', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([1, 2, 3], IDENTITY_QUAT)
    sphere.updateOrientation([10, 20, 30], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [10, 20, 30])
  })

  it('does not accumulate — calling twice with same input gives same result', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([5, 0, 0], IDENTITY_QUAT)
    sphere.updateOrientation([5, 0, 0], IDENTITY_QUAT)
    expectVec3Close(sphere.worldCenter, [5, 0, 0])
  })
})

describe('Hitbox3D.updateOrientation — orientation matrix', () => {
  it('orientation matrix has the translation in column 3 (indices 12,13,14)', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([7, 8, 9], IDENTITY_QUAT)
    expect(sphere.orientation[12]).toBeCloseTo(7, 5)
    expect(sphere.orientation[13]).toBeCloseTo(8, 5)
    expect(sphere.orientation[14]).toBeCloseTo(9, 5)
  })

  it('worldCenter reads from orientation[12,13,14]', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([3, 1, 4], IDENTITY_QUAT)
    expect(sphere.worldCenter[0]).toBe(sphere.orientation[12])
    expect(sphere.worldCenter[1]).toBe(sphere.orientation[13])
    expect(sphere.worldCenter[2]).toBe(sphere.orientation[14])
  })
})
