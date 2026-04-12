/** @internal */
export interface UniformSlot {
  buffer: GPUBuffer
  offset: number
  size: number
}

/**
 * Suballocates 256-byte-aligned uniform buffer slices from one large GPUBuffer.
 * This avoids creating hundreds of small buffers for per-object uniforms.
 * @internal
 */
export class UniformPool {
  private readonly _buffer: GPUBuffer;
  private readonly _device: GPUDevice;
  private readonly _alignment: number;
  private _nextOffset = 0;

  constructor(device: GPUDevice, totalBytes: number, label = 'UniformPool') {
    this._device = device;
    // WebGPU requires uniform buffer offsets aligned to minUniformBufferOffsetAlignment (usually 256)
    this._alignment = device.limits.minUniformBufferOffsetAlignment;
    this._buffer = device.createBuffer({
      label,
      size: totalBytes,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  /**
   * Allocates an aligned slice of `size` bytes.
   * The returned `size` is rounded up to the alignment boundary.
   */
  allocate(size: number): UniformSlot {
    const aligned = Math.ceil(size / this._alignment) * this._alignment;
    if (this._nextOffset + aligned > this._buffer.size) {
      throw new Error(
        `UniformPool exhausted: need ${aligned} bytes at offset ${this._nextOffset}, ` +
        `pool size is ${this._buffer.size}`
      );
    }
    const slot: UniformSlot = { buffer: this._buffer, offset: this._nextOffset, size: aligned };
    this._nextOffset += aligned;
    return slot;
  }

  write(slot: UniformSlot, data: Float32Array | Uint32Array, srcOffset = 0): void {
    this._device.queue.writeBuffer(this._buffer, slot.offset, data as Float32Array<ArrayBuffer>, srcOffset);
  }

  destroy(): void {
    this._buffer.destroy();
  }
}
