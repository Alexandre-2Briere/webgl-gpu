import type { Engine, IGameObject } from '@engine';
import { buildCubeVertices } from '../game/geometry';

export function spawn(engine: Engine): IGameObject {
  const { vertices, indices } = buildCubeVertices();
  const mesh = engine.createMesh({ renderable: { vertices, indices, label: 'script-object' } });
  mesh.setColor(1, 0, 1, 1);
  return mesh;
}
