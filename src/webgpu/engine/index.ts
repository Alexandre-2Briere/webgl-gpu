export { Engine } from './Engine';
export { Camera } from './core/Camera';

// GameObject and scene-object interfaces
export { GameObject } from './gameObject/GameObject';
export type { IGameObject, ISceneObject } from './gameObject/GameObject';

// Light game object
export { LightGameObject, LightType } from './gameObject/LightGameObject';

// Singleton scene objects
export { SkyboxGameObject } from './gameObject/SkyboxGameObject';
export { InfiniteGroundGameObject } from './gameObject/InfiniteGroundGameObject';

// Option types for Engine.create*() methods
export type {
  EngineOptions,
  CameraOptions,
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
  SkyboxOptions,
  InfiniteGroundOptions,
} from './types';

// Editor renderables
export { ArrowGizmo } from './gameObject/renderables';
export type { Quad3D } from './gameObject/renderables/Quad3D';

// Physics
export { Rigidbody3D } from './gameObject/rigidbody/Rigidbody3D';
export { applyPhysics, applyCollisions } from './gameObject/rigidbody/index';
export { CubeHitbox } from './gameObject/hitbox/CubeHitbox';

// Math utilities
export { safeParseFloat } from './math/vec';
export type { Vec3 } from './math/vec';

// PubSub
export type { PubSubManager } from './core/PubSub';

// Logger
export { logger } from './utils';

// Save / load
export { SaveManager, restoreFromSnapshot } from './saveManager';
export type {
  SaveSegments,
  SceneConstantsSnapshot,
  GameObjectsSnapshot,
  LightObjectsSnapshot,
  GameObjectSnapshot,
  LightObjectSnapshot,
  CameraSnapshot,
  PhysicsConfigSnapshot,
  CubeSnapshot,
  QuadSnapshot,
  FbxObjectSnapshot,
  LightSnapshot,
  DirectionalLightSnapshot,
  SkyboxSnapshot,
  InfiniteGroundSnapshot,
} from './saveManager';
