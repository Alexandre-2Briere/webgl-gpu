import type { Engine }            from '../../../../src/webgpu/engine/index';
import type { LightSpawnContext }  from './types';
import type { LightGameObject }    from '../../../../src/webgpu/engine/gameObject/LightGameObject';

/** Spawns a Directional light with neutral white color and power 1. */
export function spawn(engine: Engine, _context: LightSpawnContext): LightGameObject {
  return engine.createDirectionalLight({ color: [1, 1, 1], power: 1.0 });
}
