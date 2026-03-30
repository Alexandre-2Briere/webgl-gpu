import type { Engine, IGameObject } from '../../../../src/webgpu/engine/index'
import { buildCubeVertices } from '../game/geometry'

export function spawn(engine: Engine): IGameObject {
  const { vertices, indices } = buildCubeVertices()
  return engine.createMesh({
    renderable: { vertices, indices, label: 'cube' },
    position:   [0, 0, 0],
  })
}
