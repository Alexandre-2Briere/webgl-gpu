import { describe, it, expect } from 'vitest'
import { testMeshMesh } from '../../gameObject/rigidbody/narrowPhaseHelper/meshTests'
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function makeBox(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-halfExtents[0], -halfExtents[1], -halfExtents[2]],
    max: [halfExtents[0], halfExtents[1], halfExtents[2]],
  })
  mesh.updateOrientation(position, IDENTITY)
  return mesh
}

describe('testMeshMesh', () => {
  it('two overlapping AABBs at same position are a hit', () => {
    const result = testMeshMesh(makeBox([1, 1, 1]), makeBox([1, 1, 1]))
    expect(result.hit).toBe(true)
  })

  it('two overlapping AABBs with partial overlap are a hit', () => {
    const result = testMeshMesh(makeBox([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [1.5, 0, 0]))
    expect(result.hit).toBe(true)
  })

  it('depth is the minimum penetration on the minimal axis', () => {
    // Overlap on X: (1+1) - 1.5 = 0.5
    const result = testMeshMesh(makeBox([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [1.5, 0, 0]))
    expect(result.depth).toBeCloseTo(0.5, 4)
  })

  it('two clearly separated AABBs are not a hit', () => {
    const result = testMeshMesh(makeBox([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [5, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('two AABBs touching face-to-face return no hit (strict check)', () => {
    // Centers 2 apart, halfExtents sum = 2: touching exactly → overlap=0 → no hit
    const result = testMeshMesh(makeBox([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [2, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('zero-size AABB inside normal AABB is a hit', () => {
    const point = makeBox([0, 0, 0], [0, 0, 0])
    const box = makeBox([1, 1, 1])
    const result = testMeshMesh(box, point)
    expect(result.hit).toBe(true)
  })

  it('two zero-size AABBs at same position are a hit', () => {
    const result = testMeshMesh(makeBox([0, 0, 0], [0, 0, 0]), makeBox([0, 0, 0], [0, 0, 0]))
    // overlap = [0+0 - 0, 0+0 - 0, 0+0 - 0] = [0, 0, 0], all ≤ 0 → no hit
    expect(result.hit).toBe(false)
  })

  it('two zero-size AABBs at different positions are not a hit', () => {
    const result = testMeshMesh(makeBox([0, 0, 0], [0, 0, 0]), makeBox([0, 0, 0], [1, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('normal is a unit vector when hit', () => {
    const result = testMeshMesh(makeBox([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [1.5, 0, 0]))
    const length = Math.sqrt(result.normal[0] ** 2 + result.normal[1] ** 2 + result.normal[2] ** 2)
    expect(length).toBeCloseTo(1, 3)
  })
})
