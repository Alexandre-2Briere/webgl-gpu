import { describe, it, expect } from 'vitest'
import { testCubeMesh } from '../../gameObject/rigidbody/narrowPhaseHelper/cubeTests'
import { CubeHitbox } from '../../gameObject/hitbox/CubeHitbox'
import { MeshHitbox } from '../../gameObject/hitbox/MeshHitbox'

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

function makeCube(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): CubeHitbox {
  const cube = new CubeHitbox(halfExtents)
  cube.updateOrientation(position, IDENTITY)
  return cube
}

function makeBox(halfExtents: [number, number, number], position: [number, number, number] = [0, 0, 0]): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-halfExtents[0], -halfExtents[1], -halfExtents[2]],
    max: [halfExtents[0], halfExtents[1], halfExtents[2]],
  })
  mesh.updateOrientation(position, IDENTITY)
  return mesh
}

describe('testCubeMesh', () => {
  it('overlapping OBB and AABB at same position is a hit', () => {
    const result = testCubeMesh(makeCube([1, 1, 1]), makeBox([1, 1, 1]))
    expect(result.hit).toBe(true)
  })

  it('OBB and AABB clearly separated is not a hit', () => {
    const result = testCubeMesh(makeCube([1, 1, 1], [0, 0, 0]), makeBox([1, 1, 1], [10, 0, 0]))
    expect(result.hit).toBe(false)
  })

  it('OBB inside AABB is a hit', () => {
    const result = testCubeMesh(makeCube([0.5, 0.5, 0.5]), makeBox([2, 2, 2]))
    expect(result.hit).toBe(true)
  })

  it('zero-size cube vs normal AABB does not throw', () => {
    expect(() => testCubeMesh(makeCube([0, 0, 0]), makeBox([1, 1, 1]))).not.toThrow()
  })

  it('depth is positive when hit', () => {
    const result = testCubeMesh(makeCube([1, 1, 1]), makeBox([1, 1, 1]))
    expect(result.depth).toBeGreaterThan(0)
  })
})
