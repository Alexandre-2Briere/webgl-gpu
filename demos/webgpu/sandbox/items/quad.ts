import type { Engine, IGameObject } from '../../../../src/webgpu/engine/index'

export function spawn(engine: Engine): IGameObject {
  return engine.createQuad3D({
    renderable: {
      normal: [0, 1, 0],
      width:  1,
      height: 1,
      color:  [0.4, 0.6, 1.0, 1.0],
    },
    position: [0, 0, 0],
  })
}
