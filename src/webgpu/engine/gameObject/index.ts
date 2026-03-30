export { GameObject } from './GameObject'
export type { IGameObject, GameObjectOptions } from './GameObject'

export { Hitbox3D } from './hitbox/Hitbox3D'
export type { HitboxType } from './hitbox/Hitbox3D'
export { CubeHitbox } from './hitbox/CubeHitbox'
export { SphereHitbox } from './hitbox/SphereHitbox'
export { CapsuleHitbox } from './hitbox/CapsuleHitbox'
export { MeshHitbox } from './hitbox/MeshHitbox'

export { Rigidbody3D } from './rigidbody/Rigidbody3D'
export type { Rigidbody3DOptions } from './rigidbody/Rigidbody3D'
export { applyPhysics } from './rigidbody/physicsStep'
export { applyCollisions } from './rigidbody/collisionStep'
