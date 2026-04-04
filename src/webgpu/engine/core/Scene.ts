import type { Renderable } from '../gameObject/renderables/Renderable'
import { Camera } from './Camera'
import { Renderer } from './Renderer'
import type { LightBuffer } from '../buffers/LightBuffer'

export class Scene {
  private readonly _renderer: Renderer
  private readonly _lightBuffer: LightBuffer
  private readonly _worldRenderables: Renderable[] = []
  private readonly _overlayRenderables: Renderable[] = []

  constructor(renderer: Renderer, lightBuffer: LightBuffer) {
    this._renderer    = renderer
    this._lightBuffer = lightBuffer
  }

  add(r: Renderable): void {
    if (r.layer === 'world') {
      this._worldRenderables.push(r)
    } else {
      this._overlayRenderables.push(r)
    }
    // Sort world renderables by pipeline key to minimise setPipeline() calls
    this._worldRenderables.sort((a, b) => a.pipelineKey.localeCompare(b.pipelineKey))
  }

  destroy(): void {
    for (const r of this._worldRenderables) r.destroy()
    for (const r of this._overlayRenderables) r.destroy()
    this._worldRenderables.length = 0
    this._overlayRenderables.length = 0
  }

  remove(r: Renderable): void {
    const removeFrom = (arr: Renderable[]) => {
      const idx = arr.indexOf(r)
      if (idx !== -1) arr.splice(idx, 1)
    }
    removeFrom(this._worldRenderables)
    removeFrom(this._overlayRenderables)
  }

  /**
   * Encodes and submits one frame.
   * Called by the RAF loop in Engine with the current camera.
   */
  frame(camera: Camera, canvas: HTMLCanvasElement): void {
    const { device, queue } = this._renderer
    const aspect = canvas.width / canvas.height

    // Update camera matrices and upload to GPU
    camera.updateMatrices(aspect)
    camera.uploadTo(queue)

    // Upload any pending light changes
    this._lightBuffer.upload(queue)

    const encoder = device.createCommandEncoder({ label: 'frame' })
    const colorView = this._renderer.getCurrentColorView()
    const depthView = this._renderer.getDepthView()

    // ── 1. World render pass ───────────────────────────────────────────────────
    {
      const worldPass = encoder.beginRenderPass({
        label: 'world-pass',
        colorAttachments: [{
          view: colorView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.1, g: 0.12, b: 0.15, a: 1 },
        }],
        depthStencilAttachment: {
          view: depthView,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
          depthClearValue: 1.0,
        },
      })

      // Camera and lights bind groups are set once for the entire pass
      worldPass.setBindGroup(0, camera.bindGroup)
      worldPass.setBindGroup(3, this._lightBuffer.bindGroup)

      for (const r of this._worldRenderables) {
        if (!r.visible) continue
        r.encode(worldPass, camera)
      }

      worldPass.end()
    }

    // ── 2. Overlay render pass ─────────────────────────────────────────────────
    if (this._overlayRenderables.some(r => r.visible)) {
      const overlayPass = encoder.beginRenderPass({
        label: 'overlay-pass',
        colorAttachments: [{
          view: colorView,
          loadOp: 'load',   // composite on top of world pass output
          storeOp: 'store',
        }],
        // No depthStencilAttachment
      })

      overlayPass.setBindGroup(0, camera.bindGroup)

      for (const r of this._overlayRenderables) {
        if (!r.visible) continue
        r.encode(overlayPass, camera)
      }

      overlayPass.end()
    }

    queue.submit([encoder.finish()])
  }
}
