export { Engine } from './Engine'
export { Camera } from './core/Camera'

// GameObject and scene-object interfaces
export { GameObject } from './gameObject/GameObject'
export type { IGameObject, ISceneObject } from './gameObject/GameObject'

// Light game object
export { LightGameObject, LightType } from './gameObject/LightGameObject'

// Option types for Engine.create*() methods
export type {
  EngineOptions,
  CameraOptions,
  BindGroupLayouts,
  GameObjectBaseOptions,
  MeshOptions,
  MeshGameObjectOptions,
  Quad2DOptions,
  Quad2DGameObjectOptions,
  Quad3DOptions,
  Quad3DGameObjectOptions,
  ModelAssetHandle,
  Model3DOptions,
  Model3DGameObjectOptions,
  FbxAssetHandle,
  FbxModelOptions,
  FbxModelGameObjectOptions,
  PointLightOptions,
  AmbientLightOptions,
  DirectionalLightOptions,
  ArrowGizmoOptions,
} from './types'

// Editor renderables
export { ArrowGizmo } from './gameObject/renderables'

// Save / load
export { SaveManager } from './saveManager'
export type {
  SceneSnapshot,
  CameraSnapshot,
  ObjectSnapshot,
  PhysicsConfigSnapshot,
  CubeSnapshot,
  QuadSnapshot,
  FbxObjectSnapshot,
  LightSnapshot,
  DirectionalLightSnapshot,
} from './saveManager'
