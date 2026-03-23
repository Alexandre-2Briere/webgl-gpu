export class Renderer {
  readonly device: GPUDevice
  readonly queue: GPUQueue
  readonly context: GPUCanvasContext
  readonly format: GPUTextureFormat

  private _depthTexture: GPUTexture
  private _depthView: GPUTextureView
  private _resizeObserver: ResizeObserver

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device
    this.queue = device.queue
    this.format = navigator.gpu.getPreferredCanvasFormat()

    const ctx = canvas.getContext('webgpu')
    if (!ctx) throw new Error('Failed to get WebGPU canvas context')
    this.context = ctx

    ctx.configure({ device, format: this.format, alphaMode: 'opaque' })

    this._depthTexture = this._createDepthTexture(canvas.width || 1, canvas.height || 1)
    this._depthView = this._depthTexture.createView()

    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      const w = Math.max(1, Math.floor(entry.contentBoxSize[0].inlineSize))
      const h = Math.max(1, Math.floor(entry.contentBoxSize[0].blockSize))
      canvas.width = w
      canvas.height = h
      this._resize(w, h)
    })
    this._resizeObserver.observe(canvas)
  }

  private _createDepthTexture(width: number, height: number): GPUTexture {
    return this.device.createTexture({
      label: 'depth',
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  private _resize(width: number, height: number): void {
    this._depthTexture.destroy()
    this._depthTexture = this._createDepthTexture(width, height)
    this._depthView = this._depthTexture.createView()
  }

  getCurrentColorView(): GPUTextureView {
    return this.context.getCurrentTexture().createView()
  }

  getDepthView(): GPUTextureView {
    return this._depthView
  }

  destroy(): void {
    this._resizeObserver.disconnect()
    this._depthTexture.destroy()
  }
}
