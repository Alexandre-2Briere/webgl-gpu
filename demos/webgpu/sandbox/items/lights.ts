import type { Engine }           from '../../../../src/webgpu/engine/index'
import type { LightGameObject }  from '../../../../src/webgpu/engine/gameObject/LightGameObject'
import type { LightSpawnContext } from './types'

/** Spawns a Point light by default; the user can switch to Ambient via PropertyPanel. */
export function spawn(engine: Engine, _context: LightSpawnContext): LightGameObject {
  return engine.createPointLight({ color: [1, 1, 1], radius: 10 })
}
