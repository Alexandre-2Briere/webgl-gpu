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

/** Discriminated union — switch on `key` for exhaustive handling. */
export type ObjectSnapshot =
  | CubeSnapshot
  | QuadSnapshot
  | FbxObjectSnapshot
  | LightSnapshot
  | DirectionalLightSnapshot

export interface SceneSnapshot {
  version: 1
  camera:  CameraSnapshot
  objects: ObjectSnapshot[]
}
