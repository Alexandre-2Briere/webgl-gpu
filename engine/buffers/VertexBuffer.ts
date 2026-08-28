/** @internal */
export class VertexBuffer {
  private readonly _buffer: GPUBuffer;
  private readonly _device: GPUDevice;

  constructor(device: GPUDevice, byteSize: number, label?: string) {
    this._device = device;
    this._buffer = device.createBuffer({
      label,
      size: byteSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  get size(): number {
    return this._buffer.size;
  }

  /**
   * Uploads vertex data to the GPU buffer at `offsetBytes`.
   * Uses the backing ArrayBuffer + byteOffset form of writeBuffer() so that
   * TypedArray subarrays are uploaded correctly from their view origin.
   * @param data - Float32Array view to upload (may be a subarray)
   * @param offsetBytes - byte offset into the GPU buffer (default 0)
   */
  write(data: Float32Array, offsetBytes = 0): void {
      this._device.queue.writeBuffer(this._buffer, offsetBytes, data.buffer, data.byteOffset, data.byteLength);
  }

  destroy(): void {
    this._buffer.destroy();
  }
}
