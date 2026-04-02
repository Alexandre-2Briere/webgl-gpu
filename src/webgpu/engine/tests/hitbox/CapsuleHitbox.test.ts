import { describe, it, expect } from 'vitest'
import { CapsuleHitbox } from '../../gameObject/hitbox/CapsuleHitbox'

describe('CapsuleHitbox — construction', () => {
  it('stores the radius and height passed to the constructor', () => {
    const capsule = new CapsuleHitbox(0.5, 2)
    expect(capsule.radius).toBe(0.5)
    expect(capsule.height).toBe(2)
  })

  it('type is "capsule"', () => {
    expect(new CapsuleHitbox(1, 3).type).toBe('capsule')
  })

  it('offsetTranslation defaults to [0,0,0] when omitted', () => {
    expect(new CapsuleHitbox(1, 3).offsetTranslation).toEqual([0, 0, 0])
  })

  it('offsetRotation defaults to [0,0] when omitted', () => {
    expect(new CapsuleHitbox(1, 3).offsetRotation).toEqual([0, 0])
  })

  it('stores a provided offsetTranslation', () => {
    const capsule = new CapsuleHitbox(1, 3, [2, 0, 0])
    expect(capsule.offsetTranslation).toEqual([2, 0, 0])
  })

  it('radius of 0 is stored as-is', () => {
    expect(new CapsuleHitbox(0, 2).radius).toBe(0)
  })

  it('height of 0 is stored as-is', () => {
    expect(new CapsuleHitbox(1, 0).height).toBe(0)
  })

  it('height smaller than 2×radius (degenerate) is stored as-is', () => {
    const capsule = new CapsuleHitbox(2, 1) // 2×radius=4 > height=1
    expect(capsule.radius).toBe(2)
    expect(capsule.height).toBe(1)
  })
})

describe('CapsuleHitbox — initial world center', () => {
  it('worldCenter before any orientation update is [0,0,0]', () => {
    expect(new CapsuleHitbox(1, 4).worldCenter).toEqual([0, 0, 0])
  })
})

describe('CapsuleHitbox — clone', () => {
  it('clone returns a new CapsuleHitbox with the same radius and height', () => {
    const original = new CapsuleHitbox(0.5, 3)
    const cloned = original.clone()
    expect(cloned.radius).toBe(0.5)
    expect(cloned.height).toBe(3)
  })

  it('clone returns a different object instance', () => {
    const original = new CapsuleHitbox(1, 2)
    expect(original.clone()).not.toBe(original)
  })

  it('mutating clone radius does not affect the original', () => {
    const original = new CapsuleHitbox(1, 2)
    const cloned = original.clone()
    cloned.radius = 99
    expect(original.radius).toBe(1)
  })

  it('mutating clone height does not affect the original', () => {
    const original = new CapsuleHitbox(1, 2)
    const cloned = original.clone()
    cloned.height = 99
    expect(original.height).toBe(2)
  })

  it('clone preserves offsetTranslation', () => {
    const original = new CapsuleHitbox(1, 2, [0, 1, 0])
    expect(original.clone().offsetTranslation).toEqual([0, 1, 0])
  })
})
