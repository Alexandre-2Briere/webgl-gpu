/**
 * Base class for a single GPUBuffer backed uniform with a pre-built bind group.
 * Subclasses own the data layout and call _write() to push updates to the GPU.
 */
export class UniformBuffer {
  protected readonly _device: GPUDevice
  protected readonly _gpuBuffer: GPUBuffer
  readonly bindGroup: GPUBindGroup

  constructor(device: GPUDevice, size: number, layout: GPUBindGroupLayout, label: string) {
    this._device = device
    this._gpuBuffer = device.createBuffer({
      label,
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.bindGroup = device.createBindGroup({
      label: `${label}-bg`,
      layout,
      entries: [{ binding: 0, resource: { buffer: this._gpuBuffer } }],
    })
  }

  protected _write(queue: GPUQueue, data: ArrayBuffer): void {
    queue.writeBuffer(this._gpuBuffer, 0, data)
  }
}
