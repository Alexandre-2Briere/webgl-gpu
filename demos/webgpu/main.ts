import { Engine } from '../../src/webgpu/engine/index'
import { FOV_Y, initTileBuilder } from './tileBuilder'

async function main() {
  const canvas  = document.getElementById('webgpu-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Canvas element #webgpu-canvas not found')

  const engine = await Engine.create(canvas)

  // ── Camera ──────────────────────────────────────────────────────────────────
  // FOV_Y is imported from tileBuilder.ts — both values must always stay in sync.
  // raycastMouse() uses FOV_Y to reconstruct the view frustum; if they diverge,
  // mouse picking silently breaks (clicks land on wrong cells).
  const camera = engine.createCamera({
    fovY:     FOV_Y,
    near:     0.1,
    far:      500,
    position: [6, 18, 16],
    yaw:      0,
    pitch:    -(55 * Math.PI / 180),
  })
  engine.setCamera(camera)

  // Logic RAF is started inside initTileBuilder — must happen before engine.start()
  // so the first render frame never runs with stale camera state or a hidden highlight.
  await initTileBuilder(engine, camera, canvas)

  engine.start()
}

main().catch(err => {
  console.error('Engine init failed:', err)
})
