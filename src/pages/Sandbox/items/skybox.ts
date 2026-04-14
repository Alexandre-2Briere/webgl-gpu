import type { Engine, SkyboxGameObject } from '@engine';
import type { SingletonSpawnContext } from './types';

export function spawn(engine: Engine, _context: SingletonSpawnContext): SkyboxGameObject {
  return engine.createSkybox({ color: [0.1, 0.12, 0.15, 1] });
}
