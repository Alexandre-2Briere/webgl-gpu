// Bootstrap for the WebGPU demo.
// Wires the canvas to the engine for smoke-testing.
// Replace this body with initMarchingCubesModule() once the module is ready.

import { Engine } from '../../src/webgpu/engine/index'

async function main() {
  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Canvas element #webgpu-canvas not found')

  const engine = await Engine.create(canvas)

  // ── Camera ──────────────────────────────────────────────────────────────────
  const camera = engine.createCamera({ fovY: Math.PI / 3, near: 0.1, far: 2000 })
  camera.position.set([0, 2, 6])
  camera.yaw   = 0
  camera.pitch = -0.2
  engine.setCamera(camera)

  // ── 3D mesh — one colored triangle ──────────────────────────────────────────
  // Vertex format: vec3f pos, f32 pad, vec3f normal, f32 pad, vec4f color  (48 bytes/vertex)
  const triVertices = new Float32Array([
  //  pos.x  pos.y  pos.z   _pad   nrm.x  nrm.y  nrm.z   _pad   r     g     b     a
    -1,    0,     0,      0,    0,    0,     1,      0,   1.0,  0.2,  0.2,  1.0,
     1,    0,     0,      0,    0,    0,     1,      0,   0.2,  1.0,  0.2,  1.0,
     0,    2,     0,      0,    0,    0,     1,      0,   0.2,  0.2,  1.0,  1.0,
  ])
  engine.createMesh({ vertices: triVertices, label: 'smoke-triangle' })

  // ── 3D world-space quad — flat red quad at y=0 ──────────────────────────────
  engine.createQuad3D({
    position: [0, -0.01, 0],
    normal:   [0, 1, 0],
    width: 6,
    height: 6,
    color: [0.6, 0.15, 0.15, 0.8],
    label: 'ground-quad',
  })

  // ── 2D screen-space quad — white semi-transparent corner panel ───────────────
  engine.createQuad2D({
    x: -1.0, y: 1.0, width: 0.3, height: 0.12,
    color: [1, 1, 1, 0.6],
    label: 'hud-panel',
  })

  engine.start()
}

main().catch(err => {
  console.error('Engine init failed:', err)
})
