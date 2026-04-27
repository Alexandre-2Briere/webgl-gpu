import type { Engine, IGameObject } from '@engine';
import type { PrimitiveSpawnContext } from './types';

export function spawn(engine: Engine, context: PrimitiveSpawnContext): IGameObject {
  return engine.createCube({
    label:     'cube',
    rigidbody: context.rigidbody,
    hitbox:    context.hitbox,
  });
}
