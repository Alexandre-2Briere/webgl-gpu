import { Rigidbody3D } from '../../gameObject/rigidbody/Rigidbody3D'
import type { IGameObject } from '../../gameObject/GameObject'
import type { Renderable } from '../../gameObject/renderables/Renderable'
import type { Vec3, Vec4 } from '../../math/vec'

/**
 * Minimal IGameObject stub for physics unit tests.
 * Exposes position/quaternion directly and delegates sync to the Rigidbody3D.
 */
export function makeMockGameObject(rigidbody: Rigidbody3D, position: Vec3 = [0, 0, 0]): IGameObject {
  const obj = {
    position: [...position] as Vec3,
    quaternion: [0, 0, 0, 1] as Vec4,
    scale: [1, 1, 1] as Vec3,
    color: [1, 1, 1, 1] as [number, number, number, number],
    renderable: null as unknown as Renderable,
    hitbox: rigidbody.hitbox,
    rigidbody,

    syncToPhysics(): void {
      rigidbody.position = [...obj.position] as Vec3
      rigidbody.quaternion = [...obj.quaternion] as Vec4
    },

    syncFromPhysics(): void {
      obj.position = [...rigidbody.position] as Vec3
      obj.quaternion = [...rigidbody.quaternion] as Vec4
    },

    getRigidbody(): Rigidbody3D { return rigidbody },
    setPosition(position: Vec3): void { obj.position = position },
    setQuaternion(quaternion: Vec4): void { obj.quaternion = quaternion },
    setRotation(): void {},
    rotate(): void {},
    setScale(): void {},
    setColor(): void {},
    copy(): IGameObject { return obj as unknown as IGameObject },
    destroy(): void {},
  }
  return obj as unknown as IGameObject
}
