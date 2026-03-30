export type PropertyGroup = 'position' | 'rotation' | 'color' | 'scale' | 'rigidbody' | 'hitbox'

export interface PhysicsConfig {
  hasRigidbody: boolean
  isStatic:     boolean
  hasHitbox:    boolean
  layer:        string
}

export interface ItemEntry {
  key:        string
  label:      string
  isReady:    boolean
  properties: PropertyGroup[]
}

export type ItemRegistry = Record<string, ItemEntry[]>
