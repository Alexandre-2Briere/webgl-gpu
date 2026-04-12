import type { Rigidbody3D, CubeHitbox, FbxAssetHandle } from '@engine';

export type PropertyGroup = 'position' | 'rotation' | 'color' | 'scale' | 'rigidbody' | 'hitbox' | 'asset' | 'lightType' | 'lightRadius' | 'lightPower'

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

export interface PrimitiveSpawnContext {
  kind:       'primitive'
  rigidbody?: Rigidbody3D
  hitbox?:    CubeHitbox
}

export interface FbxSpawnContext {
  kind:       'fbx'
  asset:      FbxAssetHandle
  rigidbody?: Rigidbody3D
  hitbox?:    CubeHitbox
}

export interface LightSpawnContext {
  kind: 'light'
}

export type SpawnContext = PrimitiveSpawnContext | FbxSpawnContext | LightSpawnContext
