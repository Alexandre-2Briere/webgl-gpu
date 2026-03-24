import type { Engine, Camera } from '../../src/webgpu/engine/index'

// FOV_Y must match fovY in main.ts createCamera() call.
// raycastMouse() uses this to reconstruct the view frustum — if they diverge,
// mouse picking silently breaks (clicks land on wrong cells).
export const FOV_Y = Math.PI / 4  // 45°

export async function initTileBuilder(
  _engine: Engine,
  _camera: Camera,
  _canvas: HTMLCanvasElement,
): Promise<void> {
  // Phases 2–9 will be implemented here.
}
