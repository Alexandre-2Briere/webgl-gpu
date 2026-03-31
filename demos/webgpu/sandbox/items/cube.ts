import type { Engine, IGameObject } from '../../../../src/webgpu/engine/index'
import type { PrimitiveSpawnContext } from './types'
import { buildCubeVertices } from '../game/geometry'

export function spawn(engine: Engine, context: PrimitiveSpawnContext): IGameObject {
  const { vertices, indices } = buildCubeVertices()
  return engine.createMesh({
    renderable: { vertices, indices, label: 'cube' },
    rigidbody:  context.rigidbody,
    hitbox:     context.hitbox,
  })
}
