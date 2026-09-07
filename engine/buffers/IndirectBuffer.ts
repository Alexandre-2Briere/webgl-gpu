/**
 * @file IndirectBuffer.ts
 * @description Manages a 16-byte GPUBuffer utilized for indirect rendering draw calls.
 * 
 * Shape / Layout:
 *   - Offset 0  (4 bytes): vertexCount (u32)
 *   - Offset 4  (4 bytes): instanceCount (u32, initialized to 1)
 *   - Offset 8  (4 bytes): firstVertex (u32, initialized to 0)
 *   - Offset 12 (4 bytes): firstInstance (u32, initialized to 0)
 * 
 * GPU Usage Flags:
 *   - INDIRECT  -> Read directly during render passes via drawIndirect()
 *   - STORAGE   -> Written directly by compute shaders
 *   - COPY_DST  -> Initialized and reset from the CPU
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [IndirectBuffer.md](IndirectBuffer.md)
 * 
 * @internal
 */

export class IndirectBuffer {
  // --- Static Fields ---
  /** Default draw arguments initialized with a harmless 1 instance to avoid empty renders */
  private static readonly _zero = new Uint32Array([0, 1, 0, 0]);

  // --- Instance Fields ---
  private readonly _device: GPUDevice;
  private readonly _buffer: GPUBuffer;

  // --- Constructor ---
  /**
   * Creates a new instance of IndirectBuffer.
   * @param device - The active GPUDevice.
   * @param label - Optional layout identification label.
   */
  constructor(device: GPUDevice, label?: string) {
    this._device = device;
    this._buffer = device.createBuffer({
      label,
      size: 16,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // Initialize with instanceCount=1 so a draw without a prior compute pass is harmless
    this._device.queue.writeBuffer(this._buffer, 0, IndirectBuffer._zero);
  }

  // --- Getters / Setters ---
  /**
   * Reference to the underlying GPUBuffer resource.
   */
  get buffer(): GPUBuffer {
    return this._buffer;
  }

  // --- Public Methods ---
  /**
   * Zeroes the vertexCount property (offset 0) while keeping other bounds intact.
   * Enables clean accumulative passes on compute shaders before drawing cycles.
   */
  reset(): void {
    this._device.queue.writeBuffer(this._buffer, 0, new Uint32Array([0]));
  }

  /**
   * Reclaims and frees the GPU memory occupied by this buffer.
   */
  destroy(): void {
    this._buffer.destroy();
  }
}

