// PUBLIC API FOR THE ENGINE PACKAGE
// MUST NOT BE IMPORTED FROM INTERNALLY IN THE ENGINE PACKAGE

export { Engine } from './Engine';
export { Camera } from './core/Camera';

// GameObject and scene-object interfaces
export { GameObject } from './gameObject/3D/3DGameObject';
export type { IGameObject, ISceneObject } from './gameObject/3D/3DGameObject';

// Light game object
export { LightGameObject, LightType } from './gameObject/Light/LightGameObject';

export { UIGameObject } from './gameObject/UI/UIGameObject';

// Singleton scene objects
export { SkyboxGameObject } from './gameObject/Unique/SkyboxGameObject';
export { InfiniteGroundGameObject } from './gameObject/Unique/InfiniteGroundGameObject';

// Option types for Engine.create*() methods
export type {
  EngineOptions,
  CameraOptions,
  GameObjectBaseOptions,
  MeshOptions,
  MeshGameObjectOptions,
  CubeGameObjectOptions,
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
  Bar3DOptions,
} from './types';

export type { Bar3DHandle } from './gameObject/UI/Bar3DHandle';

// Editor renderables
export { ArrowGizmo } from './gameObject/3D/renderables/ArrowGizmo';
export type { Quad3D } from './gameObject/3D/renderables/Quad3D';

// Physics
export { Rigidbody3D } from './gameObject/3D/rigidbody/Rigidbody3D';
export { applyPhysics } from './gameObject/3D/rigidbody/physicsStep';
export { applyCollisions } from './gameObject/3D/rigidbody/collisionStep';
export { CubeHitbox } from './gameObject/3D/hitbox/CubeHitbox';

// Math utilities
export { safeParseFloat } from './math/vec';
export type { Vec3 } from './math/vec';

// PubSub
export type { PubSubManager } from './core/PubSub';

// Logger
export { logger } from './utils/logger';

// Save / load
export { SaveManager } from './saveManager/SaveManager';
export {restoreFromSnapshot} from './saveManager/restoreScene';
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
} from './saveManager/types';
