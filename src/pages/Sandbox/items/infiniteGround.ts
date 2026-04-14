import type { Engine, InfiniteGroundGameObject } from '@engine';
import type { SingletonSpawnContext } from './types';

export function spawn(engine: Engine, _context: SingletonSpawnContext): InfiniteGroundGameObject {
  return engine.createInfiniteGround({
    color:          [0.55, 0.55, 0.55, 1],
    alternateColor: [0.45, 0.45, 0.45, 1],
    yLevel:         0,
    tileSize:       16,
  });
}
