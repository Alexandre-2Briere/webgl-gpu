import type { Engine, IGameObject } from '@engine';

export function spawn(engine: Engine): IGameObject {
  return engine.createCube({ label: 'script-object', color: [1, 0, 1, 1] });
}
