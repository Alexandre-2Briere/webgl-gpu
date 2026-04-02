import { describe, it, expect } from 'vitest'
import {
  yawPitchRollToQuat,
  yawPitchToQuat,
  applyEulerDelta,
  mulQuat,
  rotateByQuat,
} from '../../math/quat'
import type { Vec3, Vec4 } from '../../math/vec'

function expectVec4Close(actual: Vec4, expected: Vec4): void {
  for (let i = 0; i < 4; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5)
  }
}

function expectVec3Close(actual: Vec3, expected: Vec3): void {
  for (let i = 0; i < 3; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5)
  }
}

function quatLength(q: Vec4): number {
  return Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2)
}

const IDENTITY: Vec4 = [0, 0, 0, 1]

// ── yawPitchRollToQuat ────────────────────────────────────────────────────────

describe('yawPitchRollToQuat', () => {
  it('zero angles produce the identity quaternion [0,0,0,1]', () => {
    expectVec4Close(yawPitchRollToQuat(0, 0, 0), IDENTITY)
  })

  it('result is always a unit quaternion (length = 1)', () => {
    const cases: [number, number, number][] = [
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      [0, Math.PI / 4, 0],
      [Math.PI, Math.PI / 3, Math.PI / 6],
    ]
    for (const [yaw, pitch, roll] of cases) {
      const q = yawPitchRollToQuat(yaw, pitch, roll)
      expect(quatLength(q)).toBeCloseTo(1, 5)
    }
  })

  it('180° yaw produces a quaternion that encodes 180° Y rotation', () => {
    const q = yawPitchRollToQuat(Math.PI, 0, 0)
    // For 180° Y rotation: [0, sin(90°), 0, cos(90°)] = [0, 1, 0, 0]
    expect(q[1]).toBeCloseTo(1, 3)
    expect(q[3]).toBeCloseTo(0, 4)
  })
})

// ── yawPitchToQuat ────────────────────────────────────────────────────────────

describe('yawPitchToQuat', () => {
  it('zero yaw and pitch produce the identity quaternion', () => {
    expectVec4Close(yawPitchToQuat(0, 0), IDENTITY)
  })

  it('is equivalent to yawPitchRollToQuat with roll=0', () => {
    const yaw = 1.2, pitch = 0.5
    expectVec4Close(yawPitchToQuat(yaw, pitch), yawPitchRollToQuat(yaw, pitch, 0))
  })

  it('result is a unit quaternion', () => {
    const q = yawPitchToQuat(Math.PI / 2, Math.PI / 4)
    expect(quatLength(q)).toBeCloseTo(1, 5)
  })
})

// ── mulQuat ───────────────────────────────────────────────────────────────────

describe('mulQuat', () => {
  it('multiplying any quaternion by identity returns the same quaternion', () => {
    const q: Vec4 = [0.5, 0.5, 0.5, 0.5]
    expectVec4Close(mulQuat(q, IDENTITY), q)
  })

  it('multiplying identity by any quaternion returns the same quaternion', () => {
    const q: Vec4 = [0.5, 0.5, 0.5, 0.5]
    expectVec4Close(mulQuat(IDENTITY, q), q)
  })

  it('composing two 90° yaw rotations produces a 180° yaw rotation', () => {
    const q90 = yawPitchRollToQuat(Math.PI / 2, 0, 0)
    const q180 = yawPitchRollToQuat(Math.PI, 0, 0)
    const composed = mulQuat(q90, q90)
    // result should match q180 (or its negation — both represent same rotation)
    const dot = composed[0] * q180[0] + composed[1] * q180[1] + composed[2] * q180[2] + composed[3] * q180[3]
    expect(Math.abs(dot)).toBeCloseTo(1, 3)
  })

  it('result is a unit quaternion when inputs are unit quaternions', () => {
    const a = yawPitchRollToQuat(0.7, 0.3, 0.1)
    const b = yawPitchRollToQuat(0.2, 1.1, 0.4)
    expect(quatLength(mulQuat(a, b))).toBeCloseTo(1, 3)
  })
})

// ── rotateByQuat ──────────────────────────────────────────────────────────────

describe('rotateByQuat', () => {
  it('rotating by identity quaternion leaves the vector unchanged', () => {
    expectVec3Close(rotateByQuat([1, 0, 0], IDENTITY), [1, 0, 0])
  })

  it('rotating the zero vector by any quaternion returns [0,0,0]', () => {
    const q = yawPitchRollToQuat(Math.PI / 2, 0, 0)
    expectVec3Close(rotateByQuat([0, 0, 0], q), [0, 0, 0])
  })

  it('90° yaw rotates [1,0,0] toward -Z (or +Z depending on convention)', () => {
    const q = yawPitchToQuat(Math.PI / 2, 0)
    const result = rotateByQuat([1, 0, 0], q)
    // Either [0,0,-1] or [0,0,1] depending on the YXZ convention used
    expect(Math.abs(result[2])).toBeCloseTo(1, 3)
    expect(result[1]).toBeCloseTo(0, 4)
  })

  it('180° yaw rotates [1,0,0] to approximately [-1,0,0]', () => {
    const q = yawPitchToQuat(Math.PI, 0)
    expectVec3Close(rotateByQuat([1, 0, 0], q), [-1, 0, 0])
  })

  it('preserves the length of the rotated vector', () => {
    const q = yawPitchRollToQuat(1.2, 0.8, 0.3)
    const v: Vec3 = [3, 1, 4]
    const result = rotateByQuat(v, q)
    const originalLength = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
    const resultLength = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2)
    expect(resultLength).toBeCloseTo(originalLength, 4)
  })
})

// ── applyEulerDelta ───────────────────────────────────────────────────────────

describe('applyEulerDelta', () => {
  it('zero delta leaves the base quaternion unchanged', () => {
    expectVec4Close(applyEulerDelta(IDENTITY, 0, 0, 0), IDENTITY)
  })

  it('applying a 90° yaw delta twice to identity equals a 180° yaw', () => {
    const q90 = yawPitchRollToQuat(Math.PI / 2, 0, 0)
    const afterFirst = applyEulerDelta(IDENTITY, Math.PI / 2, 0, 0)
    const afterSecond = applyEulerDelta(afterFirst, Math.PI / 2, 0, 0)
    const dot = afterSecond[0] * q90[1] + afterSecond[1] * q90[1] + afterSecond[2] * q90[2] + afterSecond[3] * q90[3]
    // afterSecond should represent 180° yaw, not 90°
    const q180 = yawPitchRollToQuat(Math.PI, 0, 0)
    const dotWith180 = Math.abs(
      afterSecond[0] * q180[0] + afterSecond[1] * q180[1] +
      afterSecond[2] * q180[2] + afterSecond[3] * q180[3]
    )
    expect(dotWith180).toBeCloseTo(1, 3)
  })

  it('result is a unit quaternion', () => {
    const base = yawPitchRollToQuat(0.5, 0.3, 0.1)
    const result = applyEulerDelta(base, 0.2, -0.1, 0)
    expect(quatLength(result)).toBeCloseTo(1, 3)
  })

  it('zero delta from non-identity base returns the base', () => {
    const base = yawPitchRollToQuat(1, 0.5, 0.25)
    expectVec4Close(applyEulerDelta(base, 0, 0, 0), base)
  })
})
