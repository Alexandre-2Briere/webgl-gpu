import { describe, it, expect } from 'vitest'
import {
  closestPointOnSegment,
  getCapsuleSegment,
  pointRadiusVsOBB,
  pointRadiusVsAABB,
} from '../../gameObject/rigidbody/narrowPhaseHelper/helpers'
import { CapsuleHitbox } from '../../gameObject/hitbox/CapsuleHitbox'
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox'
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox'
import type { Vec3 } from '../../math/vec'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function expectVec3Close(actual: Vec3, expected: Vec3): void {
  for (let i = 0; i < 3; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5)
  }
}

// ── closestPointOnSegment ─────────────────────────────────────────────────────

describe('closestPointOnSegment', () => {
  const start: Vec3 = [0, 0, 0]
  const end: Vec3   = [4, 0, 0]

  it('point at the midpoint of the segment returns the midpoint', () => {
    expectVec3Close(closestPointOnSegment(start, end, [2, 0, 0]), [2, 0, 0])
  })

  it('point at the start of the segment returns the start', () => {
    expectVec3Close(closestPointOnSegment(start, end, [0, 0, 0]), [0, 0, 0])
  })

  it('point at the end of the segment returns the end', () => {
    expectVec3Close(closestPointOnSegment(start, end, [4, 0, 0]), [4, 0, 0])
  })

  it('point beyond the end is clamped to the endpoint', () => {
    expectVec3Close(closestPointOnSegment(start, end, [10, 0, 0]), [4, 0, 0])
  })

  it('point before the start is clamped to the start', () => {
    expectVec3Close(closestPointOnSegment(start, end, [-5, 0, 0]), [0, 0, 0])
  })

  it('point above the midpoint projects down to the midpoint', () => {
    expectVec3Close(closestPointOnSegment(start, end, [2, 10, 0]), [2, 0, 0])
  })

  it('degenerate segment (start === end) returns the start', () => {
    const point: Vec3 = [5, 5, 5]
    expectVec3Close(closestPointOnSegment([1, 2, 3], [1, 2, 3], point), [1, 2, 3])
  })
})

// ── getCapsuleSegment ─────────────────────────────────────────────────────────

describe('getCapsuleSegment', () => {
  it('height=4 radius=1: segment half-length is max(0, 2-1)=1, segment goes ±1 on Y from center', () => {
    const capsule = new CapsuleHitbox(1, 4)
    capsule.updateOrientation([0, 0, 0], IDENTITY)
    const [segStart, segEnd] = getCapsuleSegment(capsule)
    // upAxis is [0,1,0] for identity orientation
    expect(segStart[1]).toBeCloseTo(-1, 4)
    expect(segEnd[1]).toBeCloseTo(1, 3)
  })

  it('height=2 radius=2: halfSegmentLength=max(0,1-2)=0, segment is a single point at center', () => {
    const capsule = new CapsuleHitbox(2, 2)
    capsule.updateOrientation([0, 0, 0], IDENTITY)
    const [segStart, segEnd] = getCapsuleSegment(capsule)
    expectVec3Close(segStart, segEnd) // start = end = center
  })

  it('does not throw for height=0 radius=1 (fully degenerate)', () => {
    const capsule = new CapsuleHitbox(1, 0)
    capsule.updateOrientation([0, 0, 0], IDENTITY)
    expect(() => getCapsuleSegment(capsule)).not.toThrow()
  })

  it('segment is centered at worldCenter for identity orientation', () => {
    const capsule = new CapsuleHitbox(1, 6)
    capsule.updateOrientation([3, 0, 0], IDENTITY)
    const [segStart, segEnd] = getCapsuleSegment(capsule)
    const midX = (segStart[0] + segEnd[0]) / 2
    expect(midX).toBeCloseTo(3, 4)
  })
})

// ── pointRadiusVsOBB ──────────────────────────────────────────────────────────

describe('pointRadiusVsOBB', () => {
  function makeUnitCube(): CubeHitbox {
    const cube = new CubeHitbox([1, 1, 1])
    cube.updateOrientation([0, 0, 0], IDENTITY)
    return cube
  }

  it('point at OBB center with radius=0 is a hit', () => {
    const result = pointRadiusVsOBB([0, 0, 0], 0, makeUnitCube())
    expect(result.hit).toBe(true)
  })

  it('point inside OBB is a hit', () => {
    const result = pointRadiusVsOBB([0.5, 0, 0], 0, makeUnitCube())
    expect(result.hit).toBe(true)
  })

  it('point far outside OBB is not a hit', () => {
    const result = pointRadiusVsOBB([10, 0, 0], 0, makeUnitCube())
    expect(result.hit).toBe(false)
  })

  it('point just outside OBB surface but within radius is a hit', () => {
    // Point at [1.5,0,0], OBB extends to 1.0 on X. Distance = 0.5. Radius = 0.6 > 0.5 → hit
    const result = pointRadiusVsOBB([1.5, 0, 0], 0.6, makeUnitCube())
    expect(result.hit).toBe(true)
  })

  it('point just outside OBB surface with radius too small is not a hit', () => {
    // Point at [1.5,0,0]. Distance = 0.5. Radius = 0.3 < 0.5 → no hit
    const result = pointRadiusVsOBB([1.5, 0, 0], 0.3, makeUnitCube())
    expect(result.hit).toBe(false)
  })

  it('negative radius does not throw', () => {
    expect(() => pointRadiusVsOBB([2, 0, 0], -1, makeUnitCube())).not.toThrow()
  })

  it('depth is positive when hit', () => {
    const result = pointRadiusVsOBB([0, 0, 0], 0, makeUnitCube())
    expect(result.depth).toBeGreaterThan(0)
  })
})

// ── pointRadiusVsAABB ─────────────────────────────────────────────────────────

describe('pointRadiusVsAABB', () => {
  function makeUnitMesh(): MeshHitbox {
    const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    })
    mesh.updateOrientation([0, 0, 0], IDENTITY)
    return mesh
  }

  it('point at AABB center is a hit', () => {
    expect(pointRadiusVsAABB([0, 0, 0], 0, makeUnitMesh()).hit).toBe(true)
  })

  it('point inside AABB is a hit', () => {
    expect(pointRadiusVsAABB([0.5, 0, 0], 0, makeUnitMesh()).hit).toBe(true)
  })

  it('point far outside AABB is not a hit', () => {
    expect(pointRadiusVsAABB([10, 0, 0], 0, makeUnitMesh()).hit).toBe(false)
  })

  it('point outside AABB with radius reaching surface is a hit', () => {
    expect(pointRadiusVsAABB([1.5, 0, 0], 0.6, makeUnitMesh()).hit).toBe(true)
  })

  it('point outside AABB with insufficient radius is not a hit', () => {
    expect(pointRadiusVsAABB([1.5, 0, 0], 0.3, makeUnitMesh()).hit).toBe(false)
  })

  it('zero-size AABB with point at its center is a hit', () => {
    const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
      min: [0, 0, 0],
      max: [0, 0, 0],
    })
    mesh.updateOrientation([0, 0, 0], IDENTITY)
    expect(pointRadiusVsAABB([0, 0, 0], 0, mesh).hit).toBe(true)
  })

  it('depth is positive when hit', () => {
    expect(pointRadiusVsAABB([0, 0, 0], 0, makeUnitMesh()).depth).toBeGreaterThan(0)
  })
})
