import { describe, it, expect } from 'vitest'
import { identityMat, zeroMat, mul4x4, makeTransformMatrix } from '../../math/mat'

function expectMatClose(actual: Float32Array, expected: number[]): void {
  expect(actual.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5)
  }
}

// ── identityMat ───────────────────────────────────────────────────────────────

describe('identityMat', () => {
  it('4×4 identity has 1s on the diagonal (column-major: indices 0,5,10,15)', () => {
    const mat = identityMat(4)
    expect(mat[0]).toBe(1)
    expect(mat[5]).toBe(1)
    expect(mat[10]).toBe(1)
    expect(mat[15]).toBe(1)
  })

  it('4×4 identity has 0s at all off-diagonal positions', () => {
    const mat = identityMat(4)
    const diagonalIndices = new Set([0, 5, 10, 15])
    for (let i = 0; i < 16; i++) {
      if (!diagonalIndices.has(i)) {
        expect(mat[i]).toBe(0)
      }
    }
  })

  it('3×3 identity has 9 elements with 1s at indices 0, 4, 8', () => {
    const mat = identityMat(3)
    expect(mat.length).toBe(9)
    expect(mat[0]).toBe(1)
    expect(mat[4]).toBe(1)
    expect(mat[8]).toBe(1)
    expect(mat[1]).toBe(0)
    expect(mat[2]).toBe(0)
    expect(mat[3]).toBe(0)
  })

  it('returns a Float32Array with correct size n*n', () => {
    expect(identityMat(4).length).toBe(16)
    expect(identityMat(3).length).toBe(9)
    expect(identityMat(2).length).toBe(4)
  })
})

// ── zeroMat ───────────────────────────────────────────────────────────────────

describe('zeroMat', () => {
  it('returns a matrix with all zeros', () => {
    const mat = zeroMat(4)
    for (let i = 0; i < 16; i++) {
      expect(mat[i]).toBe(0)
    }
  })
})

// ── mul4x4 ────────────────────────────────────────────────────────────────────

describe('mul4x4', () => {
  it('multiplying two identity matrices produces an identity matrix', () => {
    const identity = identityMat(4)
    const out = new Float32Array(16)
    mul4x4(identity, identity, out)
    expectMatClose(out, Array.from(identity))
  })

  it('multiplying any matrix by identity leaves it unchanged (A × I = A)', () => {
    const matA = new Float32Array([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ])
    const identity = identityMat(4)
    const out = new Float32Array(16)
    mul4x4(matA, identity, out)
    expectMatClose(out, Array.from(matA))
  })

  it('multiplying identity by any matrix leaves it unchanged (I × A = A)', () => {
    const matA = new Float32Array([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1,
    ])
    const identity = identityMat(4)
    const out = new Float32Array(16)
    mul4x4(identity, matA, out)
    expectMatClose(out, Array.from(matA))
  })

  it('writes the result into the out parameter (returns void)', () => {
    const identity = identityMat(4)
    const out = new Float32Array(16)
    const returned = mul4x4(identity, identity, out)
    expect(returned).toBeUndefined()
    expect(out[0]).toBe(1) // out was populated
  })
})

// ── makeTransformMatrix ───────────────────────────────────────────────────────

describe('makeTransformMatrix', () => {
  it('identity pose (zero position, identity quaternion, unit scale) produces identity matrix', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([0, 0, 0], [0, 0, 0, 1], [1, 1, 1], out)
    const identity = identityMat(4)
    expectMatClose(out, Array.from(identity))
  })

  it('translation [1,0,0] with identity rotation/scale sets column 3 to [1,0,0,1]', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([1, 0, 0], [0, 0, 0, 1], [1, 1, 1], out)
    // Column 3 is at indices 12,13,14,15
    expect(out[12]).toBeCloseTo(1, 5)
    expect(out[13]).toBeCloseTo(0, 5)
    expect(out[14]).toBeCloseTo(0, 5)
    expect(out[15]).toBeCloseTo(1, 5)
  })

  it('translation [0,5,-3] is stored in the translation column', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([0, 5, -3], [0, 0, 0, 1], [1, 1, 1], out)
    expect(out[12]).toBeCloseTo(0, 5)
    expect(out[13]).toBeCloseTo(5, 5)
    expect(out[14]).toBeCloseTo(-3, 5)
  })

  it('uniform scale 2 produces diagonal values [2, 2, 2, 1]', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([0, 0, 0], [0, 0, 0, 1], [2, 2, 2], out)
    expect(out[0]).toBeCloseTo(2, 5)   // column 0, row 0
    expect(out[5]).toBeCloseTo(2, 5)   // column 1, row 1
    expect(out[10]).toBeCloseTo(2, 5)  // column 2, row 2
    expect(out[15]).toBeCloseTo(1, 5)  // column 3, row 3
  })

  it('zero scale produces zeros in the rotation-scale portion', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([0, 0, 0], [0, 0, 0, 1], [0, 0, 0], out)
    expect(out[0]).toBeCloseTo(0, 5)
    expect(out[5]).toBeCloseTo(0, 5)
    expect(out[10]).toBeCloseTo(0, 5)
  })

  it('negative scale [-1,-1,-1] produces a reflection (diagonal -1,-1,-1)', () => {
    const out = new Float32Array(16)
    makeTransformMatrix([0, 0, 0], [0, 0, 0, 1], [-1, -1, -1], out)
    expect(out[0]).toBeCloseTo(-1, 5)
    expect(out[5]).toBeCloseTo(-1, 5)
    expect(out[10]).toBeCloseTo(-1, 5)
  })

  it('writes void (result is in out parameter)', () => {
    const out = new Float32Array(16)
    const returned = makeTransformMatrix([0, 0, 0], [0, 0, 0, 1], [1, 1, 1], out)
    expect(returned).toBeUndefined()
  })
})
