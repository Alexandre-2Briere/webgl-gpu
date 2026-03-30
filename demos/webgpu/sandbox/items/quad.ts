import type { Engine, IGameObject } from '../../../../src/webgpu/engine/index'
import type { Rigidbody3D } from '../../../../src/webgpu/engine/gameObject/rigidbody/Rigidbody3D'
import type { CubeHitbox } from '../../../../src/webgpu/engine/gameObject/hitbox/CubeHitbox'

export function spawn(engine: Engine, rigidbody?: Rigidbody3D, hitbox?: CubeHitbox): IGameObject {
  return engine.createQuad3D({
    renderable: {
      normal: [0, 1, 0],
      width:  1,
      height: 1,
      color:  [0.4, 0.6, 1.0, 1.0],
    },
    rigidbody,
    hitbox,
  })
}
