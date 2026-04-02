import { describe, it, expect } from 'vitest'
import { computeWorldAABB } from '../../gameObject/rigidbody/broadPhase'
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox'
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox'
import { CapsuleHitbox } from '../../gameObject/hitbox/CapsuleHitbox'
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function expectClose(a: number, b: number): void {
  expect(a).toBeCloseTo(b, 4)
}

// ── Sphere AABB ───────────────────────────────────────────────────────────────

describe('computeWorldAABB — SphereHitbox', () => {
  it('sphere radius=1 at origin: AABB is [-1,-1,-1] to [1,1,1]', () => {
    const sphere = new SphereHitbox(1)
    sphere.updateOrientation([0, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(sphere)
    expectClose(aabb.min[0], -1); expectClose(aabb.min[1], -1); expectClose(aabb.min[2], -1)
    expectClose(aabb.max[0],  1); expectClose(aabb.max[1],  1); expectClose(aabb.max[2],  1)
  })

  it('sphere radius=2 at [3,0,0]: AABB is [1,-2,-2] to [5,2,2]', () => {
    const sphere = new SphereHitbox(2)
    sphere.updateOrientation([3, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(sphere)
    expectClose(aabb.min[0], 1); expectClose(aabb.min[1], -2); expectClose(aabb.min[2], -2)
    expectClose(aabb.max[0], 5); expectClose(aabb.max[1],  2); expectClose(aabb.max[2],  2)
  })

  it('sphere radius=0.5 at [0,5,0]: AABB extends by 0.5 in all directions around center', () => {
    const sphere = new SphereHitbox(0.5)
    sphere.updateOrientation([0, 5, 0], IDENTITY)
    const aabb = computeWorldAABB(sphere)
    expectClose(aabb.min[1], 4.5)
    expectClose(aabb.max[1], 5.5)
  })
})

// ── Cube AABB ─────────────────────────────────────────────────────────────────

describe('computeWorldAABB — CubeHitbox', () => {
  it('axis-aligned cube halfExtents=[1,1,1] at origin: AABB is [-1,-1,-1] to [1,1,1]', () => {
    const cube = new CubeHitbox([1, 1, 1])
    cube.updateOrientation([0, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(cube)
    expectClose(aabb.min[0], -1); expectClose(aabb.min[1], -1); expectClose(aabb.min[2], -1)
    expectClose(aabb.max[0],  1); expectClose(aabb.max[1],  1); expectClose(aabb.max[2],  1)
  })

  it('axis-aligned cube at [5,0,0]: AABB is [4,-1,-1] to [6,1,1]', () => {
    const cube = new CubeHitbox([1, 1, 1])
    cube.updateOrientation([5, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(cube)
    expectClose(aabb.min[0], 4); expectClose(aabb.max[0], 6)
  })

  it('asymmetric half-extents [2,0.5,1] at origin: AABB matches half-extents', () => {
    const cube = new CubeHitbox([2, 0.5, 1])
    cube.updateOrientation([0, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(cube)
    expectClose(aabb.min[0], -2); expectClose(aabb.max[0], 2)
    expectClose(aabb.min[1], -0.5); expectClose(aabb.max[1], 0.5)
    expectClose(aabb.min[2], -1); expectClose(aabb.max[2], 1)
  })
})

// ── Capsule AABB ──────────────────────────────────────────────────────────────

describe('computeWorldAABB — CapsuleHitbox', () => {
  it('capsule radius=1 height=4 at origin (upright): Y extends by height/2 + radius', () => {
    // broadPhase uses height/2 (not halfSegmentLength) to compute AABB
    const capsule = new CapsuleHitbox(1, 4)
    capsule.updateOrientation([0, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(capsule)
    // halfLength = 4/2 = 2; upAxis Y=1 → Y range: 0 ± 2 ± 1 → [-3, 3]
    expectClose(aabb.min[1], -3)
    expectClose(aabb.max[1],  3)
    // X and Z: upAxis=0, so only radius contributes → [-1, 1]
    expectClose(aabb.min[0], -1)
    expectClose(aabb.max[0],  1)
  })
})

// ── Mesh AABB ─────────────────────────────────────────────────────────────────

describe('computeWorldAABB — MeshHitbox', () => {
  it('mesh halfExtents=[2,2,2] at origin: AABB is [-2,-2,-2] to [2,2,2]', () => {
    const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
      min: [-2, -2, -2],
      max: [2, 2, 2],
    })
    mesh.updateOrientation([0, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(mesh)
    expectClose(aabb.min[0], -2); expectClose(aabb.max[0], 2)
    expectClose(aabb.min[1], -2); expectClose(aabb.max[1], 2)
    expectClose(aabb.min[2], -2); expectClose(aabb.max[2], 2)
  })

  it('mesh at [3,0,0]: AABB is translated correctly', () => {
    const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    })
    mesh.updateOrientation([3, 0, 0], IDENTITY)
    const aabb = computeWorldAABB(mesh)
    expectClose(aabb.min[0], 2); expectClose(aabb.max[0], 4)
  })
})
