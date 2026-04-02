import { describe, it, expect } from 'vitest'
import { cross3, norm3, dot, addVec, subVec, scaleVec, lenSq, safeNorm3 } from '../../math/vec'

const EPSILON = 1e-5

function expectVec3Close(actual: number[], expected: number[]): void {
  for (let i = 0; i < 3; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 2)
  }
}

// ── cross3 ────────────────────────────────────────────────────────────────────

describe('cross3', () => {
  it('produces a vector perpendicular to two orthogonal unit vectors', () => {
    expectVec3Close(cross3([1, 0, 0], [0, 1, 0]), [0, 0, 1])
  })

  it('produces zero vector for two parallel vectors', () => {
    expectVec3Close(cross3([1, 0, 0], [1, 0, 0]), [0, 0, 0])
  })

  it('produces zero vector when both inputs are zero', () => {
    expectVec3Close(cross3([0, 0, 0], [0, 0, 0]), [0, 0, 0])
  })

  it('anti-commutes: cross(a,b) = -cross(b,a)', () => {
    const ab = cross3([1, 2, 3], [4, 5, 6])
    const ba = cross3([4, 5, 6], [1, 2, 3])
    expectVec3Close(ab, [-ba[0], -ba[1], -ba[2]])
  })

  it('produces NaN values when a vector is missing the third component', () => {
    const result = cross3([1, 0, 0], [0, 1]) // b[2] is undefined
    expect(Number.isNaN(result[0])).toBe(true)
    expect(Number.isNaN(result[1])).toBe(true)
  })

  it('produces NaN values for empty vectors', () => {
    const result = cross3([], [])
    expect(Number.isNaN(result[0])).toBe(true)
  })
})

// ── norm3 ─────────────────────────────────────────────────────────────────────

describe('norm3', () => {
  it('normalizes a standard 3D vector to unit length', () => {
    expectVec3Close(norm3([3, 4, 0]), [0.6, 0.8, 0])
  })

  it('leaves a unit vector unchanged', () => {
    expectVec3Close(norm3([1, 0, 0]), [1, 0, 0])
  })

  it('returns safe fallback [0,1,0] for a zero vector', () => {
    expect(norm3([0, 0, 0])).toEqual([0, 1, 0])
  })

  it('result has unit length for any non-zero vector', () => {
    const result = norm3([3, 1, 4])
    const length = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2)
    expect(length).toBeCloseTo(1, 5)
  })

  it('returns safe fallback [0,1,0] for empty array (degenerate input)', () => {
    expect(norm3([])).toEqual([0, 1, 0])
  })
})

// ── safeNorm3 ─────────────────────────────────────────────────────────────────

describe('safeNorm3', () => {
  it('normalizes a standard vector correctly', () => {
    expectVec3Close(safeNorm3([3, 4, 0]), [0.6, 0.8, 0])
  })

  it('returns [0,1,0] for a zero vector (lenSq = 0 < threshold)', () => {
    expect(safeNorm3([0, 0, 0])).toEqual([0, 1, 0])
  })

  it('returns [0,1,0] for a near-zero vector (lenSq < 1e-12)', () => {
    expect(safeNorm3([1e-7, 0, 0])).toEqual([0, 1, 0])
  })

  it('result has approximately unit length for a normal vector', () => {
    const result = safeNorm3([1, 2, 3])
    const length = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2)
    expect(length).toBeCloseTo(1, 3)
  })

  it('returns [0,1,0] for a unit vector that is near-zero squared-length due to float imprecision... or normalizes it', () => {
    // [1,0,0] has lenSq = 1, so it passes the threshold and gets normalized
    expectVec3Close(safeNorm3([1, 0, 0]), [1, 0, 0])
  })
})

// ── dot ───────────────────────────────────────────────────────────────────────

describe('dot', () => {
  it('returns 0 for orthogonal unit vectors', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0)
  })

  it('returns the squared length when dotting a vector with itself', () => {
    expect(dot([3, 0, 0], [3, 0, 0])).toBe(9)
  })

  it('returns 0 when one vector is the zero vector', () => {
    expect(dot([1, 2, 3], [0, 0, 0])).toBe(0)
  })

  it('returns 0 for two empty vectors', () => {
    expect(dot([], [])).toBe(0)
  })

  it('throws when vectors have different lengths', () => {
    expect(() => dot([1, 2, 3], [1, 2])).toThrow()
  })

  it('throws when one vector is empty and the other is not', () => {
    expect(() => dot([1, 2, 3], [])).toThrow()
  })

  it('is commutative: dot(a,b) === dot(b,a)', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(dot([4, 5, 6], [1, 2, 3]))
  })
})

// ── addVec ────────────────────────────────────────────────────────────────────

describe('addVec', () => {
  it('adds two vectors component-wise', () => {
    expect(addVec([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9])
  })

  it('adding zero vector leaves the original unchanged', () => {
    expect(addVec([1, 2, 3], [0, 0, 0])).toEqual([1, 2, 3])
  })

  it('adding a vector to its negation produces zero', () => {
    expect(addVec([1, 2, 3], [-1, -2, -3])).toEqual([0, 0, 0])
  })

  it('returns empty array when both inputs are empty', () => {
    expect(addVec([], [])).toEqual([])
  })

  it('produces NaN values when a is longer than b (undefined slot in b)', () => {
    const result = addVec([1, 2, 3], [1, 2])
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(4)
    expect(Number.isNaN(result[2])).toBe(true)
  })

  it('ignores extra elements in b when b is longer than a', () => {
    const result = addVec([1, 2], [1, 2, 3])
    expect(result).toEqual([2, 4])
    expect(result.length).toBe(2)
  })
})

// ── subVec ────────────────────────────────────────────────────────────────────

describe('subVec', () => {
  it('subtracts two vectors component-wise', () => {
    expect(subVec([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3])
  })

  it('subtracting a vector from itself produces zero', () => {
    expect(subVec([1, 2, 3], [1, 2, 3])).toEqual([0, 0, 0])
  })

  it('returns empty array when both inputs are empty', () => {
    expect(subVec([], [])).toEqual([])
  })

  it('produces NaN when a is longer than b', () => {
    const result = subVec([1, 2, 3], [1, 2])
    expect(Number.isNaN(result[2])).toBe(true)
  })
})

// ── scaleVec ──────────────────────────────────────────────────────────────────

describe('scaleVec', () => {
  it('scales each component by the scalar', () => {
    expect(scaleVec([1, 2, 3], 2)).toEqual([2, 4, 6])
  })

  it('scaling by 0 produces a zero vector', () => {
    expect(scaleVec([1, 2, 3], 0)).toEqual([0, 0, 0])
  })

  it('scaling by -1 negates all components', () => {
    expect(scaleVec([1, 2, 3], -1)).toEqual([-1, -2, -3])
  })

  it('scaling an empty vector returns an empty array', () => {
    expect(scaleVec([], 5)).toEqual([])
  })

  it('scaling by 1 returns the same values', () => {
    expect(scaleVec([3, 7, -2], 1)).toEqual([3, 7, -2])
  })
})

// ── lenSq ─────────────────────────────────────────────────────────────────────

describe('lenSq', () => {
  it('returns the squared magnitude of a vector', () => {
    expect(lenSq([3, 4, 0])).toBe(25)
  })

  it('returns 0 for the zero vector', () => {
    expect(lenSq([0, 0, 0])).toBe(0)
  })

  it('returns 1 for a unit vector', () => {
    expect(lenSq([1, 0, 0])).toBe(1)
  })

  it('returns 0 for an empty array', () => {
    expect(lenSq([])).toBe(0)
  })

  it('works for 2D vectors as well', () => {
    expect(lenSq([3, 4])).toBe(25)
  })
})
