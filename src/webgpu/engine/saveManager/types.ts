export interface CameraSnapshot {
  position: [number, number, number]
  yaw:      number
  pitch:    number
}

export interface PhysicsConfigSnapshot {
  hasRigidbody: boolean
  isStatic:     boolean
  hasHitbox:    boolean
  layer:        string
}

/** Shared base fields carried by every object kind. */
interface BaseObjectSnapshot {
  label:         string
  properties:    string[]
  physicsConfig: PhysicsConfigSnapshot
  position:      [number, number, number]
  quaternion:    [number, number, number, number]
  scale:         [number, number, number]
  color:         [number, number, number, number]
}

export interface CubeSnapshot extends BaseObjectSnapshot {
  key: 'Cube'
}

export interface QuadSnapshot extends BaseObjectSnapshot {
  key: 'Quad'
}

export interface FbxObjectSnapshot extends BaseObjectSnapshot {
  key:      'FBX'
  assetUrl: string
}

/** 'Light' spawns as Point by default; lightType may be 0 (Ambient) or 1 (Point) after user edits. */
export interface LightSnapshot extends BaseObjectSnapshot {
  key:       'Light'
  lightType: 0 | 1
  radius:    number
  direction: [number, number, number]
}

export interface DirectionalLightSnapshot extends BaseObjectSnapshot {
  key:       'DirectionalLight'
  lightType: 2
  radius:    number
  direction: [number, number, number]
}

export type GameObjectSnapshot = CubeSnapshot | QuadSnapshot | FbxObjectSnapshot

export type LightObjectSnapshot = LightSnapshot | DirectionalLightSnapshot

export interface SceneConstantsSnapshot {
  version: 1
  camera:  CameraSnapshot
}

export interface GameObjectsSnapshot {
  version: 1
  objects: GameObjectSnapshot[]
}

export interface LightObjectsSnapshot {
  version: 1
  objects: LightObjectSnapshot[]
}

/**
 * All decoded segments from a combined save string.
 * Each field is an array to support multiple saves of the same type.
 * Extend by adding new optional array fields for future segment types.
 */
export interface SaveSegments {
  sceneConstants: SceneConstantsSnapshot[]
  gameObjects:    GameObjectsSnapshot[]
  lightObjects:   LightObjectsSnapshot[]
}
