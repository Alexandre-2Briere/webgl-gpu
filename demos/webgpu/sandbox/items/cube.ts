import type { Engine, IGameObject } from '../../../../src/webgpu/engine/index'
import type { Rigidbody3D } from '../../../../src/webgpu/engine/gameObject/rigidbody/Rigidbody3D'
import type { CubeHitbox } from '../../../../src/webgpu/engine/gameObject/hitbox/CubeHitbox'
import { buildCubeVertices } from '../game/geometry'

export function spawn(engine: Engine, rigidbody?: Rigidbody3D, hitbox?: CubeHitbox): IGameObject {
  const { vertices, indices } = buildCubeVertices()
  return engine.createMesh({
    renderable: { vertices, indices, label: 'cube' },
    rigidbody,
    hitbox,
  })
}
