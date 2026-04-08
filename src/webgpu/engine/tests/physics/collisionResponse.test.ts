import { describe, it, expect, vi } from 'vitest'
import { applyCollisions } from '../../gameObject/rigidbody/collisionStep'
import { Rigidbody3D } from '../../gameObject/rigidbody/Rigidbody3D'
import { SphereHitbox } from '../../gameObject/hitbox/SphereHitbox'
import { makeMockGameObject } from './mockGameObject'

function makeSphereBody(options: {
  position: [number, number, number]
  radius?: number
  isStatic?: boolean
  mass?: number
  layer?: string
  onCollision?: (other: Rigidbody3D) => void
  onOverlap?: (other: Rigidbody3D) => void
}): Rigidbody3D {
  const radius = options.radius ?? 1
  const hitbox = new SphereHitbox(radius)
  const rb = new Rigidbody3D({
    layer: options.layer ?? 'default',
    isStatic: options.isStatic ?? false,
    mass: options.mass ?? 1,
    useGravity: false,
    hitbox,
    onCollision: options.onCollision,
    onOverlap: options.onOverlap,
  })
  rb.position = [...options.position] as [number, number, number]
  hitbox.updateOrientation(rb.position, rb.quaternion)
  return rb
}

// ── Position correction ───────────────────────────────────────────────────────

describe('applyCollisions — positional correction', () => {
  it('two overlapping dynamic spheres are pushed apart', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0] })
    const rbB = makeSphereBody({ position: [1.5, 0, 0] }) // overlap: sum=2, dist=1.5

    const objA = makeMockGameObject(rbA, [0, 0, 0])
    const objB = makeMockGameObject(rbB, [1.5, 0, 0])

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [objA, objB])

    // A should be pushed in -X, B in +X
    expect(rbA.position[0]).toBeLessThan(0)
    expect(rbB.position[0]).toBeGreaterThan(1.5)
  })

  it('a dynamic sphere against a static sphere: only the dynamic body moves', () => {
    const rbStatic = makeSphereBody({ position: [0, 0, 0], isStatic: true })
    const rbDynamic = makeSphereBody({ position: [1.5, 0, 0] })

    const objS = makeMockGameObject(rbStatic)
    const objD = makeMockGameObject(rbDynamic, [1.5, 0, 0])

    const layerMap = new Map([['default', [rbStatic, rbDynamic]]])
    applyCollisions(layerMap, [objS, objD])

    expect(rbStatic.position[0]).toBe(0) // static never moves
    expect(rbDynamic.position[0]).toBeGreaterThan(1.5) // pushed away
  })

  it('two static spheres overlapping: neither body moves', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0], isStatic: true })
    const rbB = makeSphereBody({ position: [1.5, 0, 0], isStatic: true })

    const objA = makeMockGameObject(rbA)
    const objB = makeMockGameObject(rbB, [1.5, 0, 0])

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [objA, objB])

    expect(rbA.position[0]).toBe(0)
    expect(rbB.position[0]).toBe(1.5)
  })

  it('two non-overlapping spheres: positions are unchanged', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0] })
    const rbB = makeSphereBody({ position: [5, 0, 0] }) // no overlap: dist=5 > sum=2

    const objA = makeMockGameObject(rbA)
    const objB = makeMockGameObject(rbB, [5, 0, 0])

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [objA, objB])

    expect(rbA.position[0]).toBe(0)
    expect(rbB.position[0]).toBe(5)
  })
})

// ── Velocity impulse ──────────────────────────────────────────────────────────

describe('applyCollisions — velocity impulse', () => {
  it('two dynamic spheres approaching each other bounce apart', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0] })
    const rbB = makeSphereBody({ position: [1.5, 0, 0] })
    rbA.velocity = [1, 0, 0]  // moving toward B
    rbB.velocity = [-1, 0, 0] // moving toward A

    const objA = makeMockGameObject(rbA)
    const objB = makeMockGameObject(rbB, [1.5, 0, 0])

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [objA, objB])

    // After impulse, A should not be moving toward B anymore
    // and B should not be moving toward A
    expect(rbA.velocity[0]).toBeCloseTo(0, 2)
    expect(rbB.velocity[0]).toBeCloseTo(0, 2)
  })
})

// ── Callbacks ─────────────────────────────────────────────────────────────────

describe('applyCollisions — callbacks', () => {
  it('onCollision is called for both dynamic bodies when a collision occurs', () => {
    const collisionA = vi.fn()
    const collisionB = vi.fn()

    const rbA = makeSphereBody({ position: [0, 0, 0], onCollision: collisionA })
    const rbB = makeSphereBody({ position: [1.5, 0, 0], onCollision: collisionB })

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [makeMockGameObject(rbA), makeMockGameObject(rbB, [1.5, 0, 0])])

    expect(collisionA).toHaveBeenCalledOnce()
    expect(collisionB).toHaveBeenCalledOnce()
  })

  it('onCollision receives the other rigidbody as argument', () => {
    let receivedByA: Rigidbody3D | undefined
    const rbA = makeSphereBody({
      position: [0, 0, 0],
      onCollision: (other) => { receivedByA = other },
    })
    const rbB = makeSphereBody({ position: [1.5, 0, 0] })

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [makeMockGameObject(rbA), makeMockGameObject(rbB, [1.5, 0, 0])])

    expect(receivedByA).toBe(rbB)
  })

  it('onOverlap is called before physical response (even for static-static)', () => {
    const overlapA = vi.fn()
    const overlapB = vi.fn()

    const rbA = makeSphereBody({ position: [0, 0, 0], isStatic: true, onOverlap: overlapA })
    const rbB = makeSphereBody({ position: [1.5, 0, 0], isStatic: true, onOverlap: overlapB })

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [makeMockGameObject(rbA), makeMockGameObject(rbB, [1.5, 0, 0])])

    expect(overlapA).toHaveBeenCalledOnce()
    expect(overlapB).toHaveBeenCalledOnce()
  })

  it('callbacks are NOT called when spheres are not overlapping', () => {
    const collisionA = vi.fn()
    const rbA = makeSphereBody({ position: [0, 0, 0], onCollision: collisionA })
    const rbB = makeSphereBody({ position: [5, 0, 0] })

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [makeMockGameObject(rbA), makeMockGameObject(rbB, [5, 0, 0])])

    expect(collisionA).not.toHaveBeenCalled()
  })
})

// ── Layer isolation ───────────────────────────────────────────────────────────

describe('applyCollisions — layer isolation', () => {
  it('bodies on different layers do not collide', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0], layer: 'A' })
    const rbB = makeSphereBody({ position: [1.5, 0, 0], layer: 'B' })

    const objA = makeMockGameObject(rbA)
    const objB = makeMockGameObject(rbB, [1.5, 0, 0])

    // Each layer has its own array — they never meet
    const layerMap = new Map([['A', [rbA]], ['B', [rbB]]])
    applyCollisions(layerMap, [objA, objB])

    expect(rbA.position[0]).toBe(0) // not pushed
    expect(rbB.position[0]).toBe(1.5)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('applyCollisions — edge cases', () => {
  it('empty objects array does not throw', () => {
    expect(() => applyCollisions(new Map(), [])).not.toThrow()
  })

  it('empty layerMap does not throw', () => {
    const rb = makeSphereBody({ position: [0, 0, 0] })
    expect(() => applyCollisions(new Map(), [makeMockGameObject(rb)])).not.toThrow()
  })

  it('single object in a layer does not throw (no pair to test)', () => {
    const rb = makeSphereBody({ position: [0, 0, 0] })
    const layerMap = new Map([['default', [rb]]])
    expect(() => applyCollisions(layerMap, [makeMockGameObject(rb)])).not.toThrow()
  })

  it('syncFromPhysics is called on objects after resolution (position synced back)', () => {
    const rbA = makeSphereBody({ position: [0, 0, 0] })
    const rbB = makeSphereBody({ position: [1.5, 0, 0] })

    const objA = makeMockGameObject(rbA, [0, 0, 0])
    const objB = makeMockGameObject(rbB, [1.5, 0, 0])

    const layerMap = new Map([['default', [rbA, rbB]]])
    applyCollisions(layerMap, [objA, objB])

    // After applyCollisions, obj positions should reflect the corrected rigidbody positions
    expect(objA.position[0]).toBeCloseTo(rbA.position[0], 4)
    expect(objB.position[0]).toBeCloseTo(rbB.position[0], 4)
  })
})
