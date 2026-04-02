import { describe, it, expect } from 'vitest'
import { applyPhysics } from '../../gameObject/rigidbody/physicsStep'
import { Rigidbody3D } from '../../gameObject/rigidbody/Rigidbody3D'
import { makeMockGameObject } from './mockGameObject'

const GRAVITY = 9.81

// ── Gravity application ───────────────────────────────────────────────────────

describe('applyPhysics — gravity', () => {
  it('decreases Y velocity by gravity * dt for a non-static body with useGravity', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 1)
    expect(rb.velocity[1]).toBeCloseTo(-GRAVITY, 4)
  })

  it('does not change velocity when useGravity is false', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: false })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 1)
    expect(rb.velocity[1]).toBe(0)
  })

  it('does not change velocity for a static body even with useGravity', () => {
    const rb = new Rigidbody3D({ layer: 'test', isStatic: true, useGravity: true })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 1)
    expect(rb.velocity[1]).toBe(0)
  })

  it('applies half gravity for dt=0.5', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 0.5)
    expect(rb.velocity[1]).toBeCloseTo(-GRAVITY * 0.5, 4)
  })
})

// ── Position integration ──────────────────────────────────────────────────────

describe('applyPhysics — position integration', () => {
  it('integrates velocity into position after one step', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 1)
    // After 1s of gravity from rest: velocity=-9.81, position[1] = 0 + (-9.81)*1
    expect(rb.position[1]).toBeCloseTo(-GRAVITY, 4)
  })

  it('existing horizontal velocity is preserved after gravity step', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    rb.velocity[0] = 5
    rb.velocity[2] = -3
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], 1)
    expect(rb.velocity[0]).toBe(5)
    expect(rb.velocity[2]).toBe(-3)
  })

  it('position changes in X and Z from pre-existing velocity', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: false })
    rb.velocity = [2, 0, -3]
    const obj = makeMockGameObject(rb, [0, 0, 0])
    applyPhysics([obj], 1)
    expect(rb.position[0]).toBeCloseTo(2, 4)
    expect(rb.position[2]).toBeCloseTo(-3, 4)
  })

  it('dt=0 produces no change to velocity or position', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    rb.position = [1, 2, 3]
    const obj = makeMockGameObject(rb, [1, 2, 3])
    applyPhysics([obj], 0)
    expect(rb.velocity[1]).toBe(0)
    expect(rb.position[0]).toBe(1)
    expect(rb.position[1]).toBe(2)
    expect(rb.position[2]).toBe(3)
  })

  it('negative dt reverses gravity direction (position moves up)', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: true })
    const obj = makeMockGameObject(rb)
    applyPhysics([obj], -1)
    expect(rb.velocity[1]).toBeCloseTo(GRAVITY, 4)
    expect(rb.position[1]).toBeLessThan(0)
  })

  it('static body position and velocity are unchanged', () => {
    const rb = new Rigidbody3D({ layer: 'test', isStatic: true, useGravity: true })
    rb.position = [5, 10, 15]
    const obj = makeMockGameObject(rb, [5, 10, 15])
    applyPhysics([obj], 2)
    expect(rb.velocity).toEqual([0, 0, 0])
    expect(rb.position[0]).toBe(5)
    expect(rb.position[1]).toBe(10)
    expect(rb.position[2]).toBe(15)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('applyPhysics — edge cases', () => {
  it('empty objects array does not throw', () => {
    expect(() => applyPhysics([], 1)).not.toThrow()
  })

  it('object with no rigidbody is skipped without error', () => {
    const rbNull = new Rigidbody3D({ layer: 'test', useGravity: true })
    const obj = makeMockGameObject(rbNull)
    // Override getRigidbody to simulate no rigidbody
    ;(obj as any).getRigidbody = () => null
    expect(() => applyPhysics([obj], 1)).not.toThrow()
  })

  it('syncToPhysics is called before velocity integration (rigidbody sees current position)', () => {
    const rb = new Rigidbody3D({ layer: 'test', useGravity: false })
    rb.velocity = [0, 0, 0]
    const obj = makeMockGameObject(rb, [0, 10, 0]) // object is at Y=10
    // syncToPhysics should copy obj.position to rb.position before integration
    applyPhysics([obj], 0) // dt=0 to avoid position changes
    expect(rb.position[1]).toBeCloseTo(10, 4) // rigidbody should have received the position
  })
})
