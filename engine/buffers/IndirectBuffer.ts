/**
 * Manages the 16-byte DrawIndirect args buffer written by a compute shader
 * and consumed by drawIndirect().
 *
 * Layout: { vertexCount: u32, instanceCount: u32, firstVertex: u32, firstInstance: u32 }
 *
 * Usage flags: INDIRECT | STORAGE | COPY_DST
 *   - STORAGE  → compute shader can write vertexCount
 *   - INDIRECT → render pass can read it via drawIndirect()
 *   - COPY_DST → CPU can zero vertexCount before each compute pass
 * @internal
 */
export class IndirectBuffer {
  private readonly _buffer: GPUBuffer;
  private readonly _device: GPUDevice;
  private static readonly _zero = new Uint32Array([0, 1, 0, 0]);

  constructor(device: GPUDevice, label?: string) {
    this._device = device;
    this._buffer = device.createBuffer({
      label,
      size: 16,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // Initialize with instanceCount=1 so a draw without a prior compute pass is harmless
    device.queue.writeBuffer(this._buffer, 0, IndirectBuffer._zero);
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  /**
   * Zeroes vertexCount (offset 0) so the compute shader starts from 0 each frame.
   * instanceCount (offset 4) stays 1, firstVertex and firstInstance stay 0.
   */
  reset(): void {
    this._device.queue.writeBuffer(this._buffer, 0, new Uint32Array([0]));
  }

  destroy(): void {
    this._buffer.destroy();
  }
}
