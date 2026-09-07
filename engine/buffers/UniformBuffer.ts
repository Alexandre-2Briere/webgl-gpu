/**
 * @file UniformBuffer.ts
 * @description Base class that encapsulates a GPUBuffer backed uniform and auto-instantiates
 * its matching singleGPUBindGroup at binding index 0.
 * 
 * Shape / Layout:
 *   - Flexible/Custom, set during constructor creation.
 * 
 * GPU Usage Flags:
 *   - UNIFORM  -> Reads as constants/parameters inside pipeline stages
 *   - COPY_DST -> dynamic host-to-device uploads
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [UniformBuffer.md](UniformBuffer.md)
 * 
 * @internal
 */

export class UniformBuffer {
  // --- Instance Fields ---
  protected readonly _device: GPUDevice;
  protected readonly _gpuBuffer: GPUBuffer;
  private readonly _bindGroup: GPUBindGroup;

  // --- Constructor ---
  /**
   * Creates a new instance of UniformBuffer.
   * @param device - active GPUDevice.
   * @param size - byte size of the uniform buffer.
   * @param layout - bind group layout; must have a uniform buffer entry at binding 0.
   * @param label - debug label (also gets used as bind group label with `-bg` suffix).
   */
  constructor(device: GPUDevice, size: number, layout: GPUBindGroupLayout, label: string) {
    this._device = device;
    this._gpuBuffer = device.createBuffer({
      label,
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._bindGroup = device.createBindGroup({
      label: `${label}-bg`,
      layout,
      entries: [{ binding: 0, resource: { buffer: this._gpuBuffer } }],
    });
  }

  // --- Getters / Setters ---
  /**
   * Reference to the pre-built GPUBindGroup for binding 0.
   */
  get bindGroup(): GPUBindGroup {
    return this._bindGroup;
  }

  // --- Public Methods ---
  /**
   * Reclaims and frees the GPU memory occupied by this buffer.
   */
  destroy(): void {
    this._gpuBuffer.destroy();
  }

  // --- Protected Methods ---
  /**
   * Pushes raw ArrayBuffer data to the GPU buffer at offset 0.
   * Typically invoked by subclass serializer implementations.
   * @param queue - The active GPUQueue.
   * @param data - The data buffer to override on the GPU.
   */
  protected _write(queue: GPUQueue, data: ArrayBuffer): void {
    queue.writeBuffer(this._gpuBuffer, 0, data);
  }
}

