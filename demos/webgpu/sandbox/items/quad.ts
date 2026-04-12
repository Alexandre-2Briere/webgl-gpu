import type { Engine, IGameObject } from '@engine';
import type { PrimitiveSpawnContext } from './types';

export function spawn(engine: Engine, context: PrimitiveSpawnContext): IGameObject {
  return engine.createQuad3D({
    renderable: {
      normal: [0, 1, 0],
      width:  1,
      height: 1,
      color:  [0.4, 0.6, 1.0, 1.0],
    },
    rigidbody: context.rigidbody,
    hitbox:    context.hitbox,
  });
}
