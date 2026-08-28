/** @internal */
export interface UniformSlot {
  buffer: GPUBuffer
  offset: number
  size: number
}

/**
 * Suballocates 256-byte-aligned uniform buffer slices from a chain of GPUBuffer chunks.
 * Grows automatically by adding new chunks when the current chunk fills up.
 * Freed slots are recycled via an internal freelist, enabling reuse across destroy/create cycles.
 * @internal
 */
export class UniformPool {
  private readonly _device: GPUDevice;
  private readonly _alignment: number;
  private readonly _chunkSize: number;
  private readonly _chunks: GPUBuffer[] = [];
  private _nextOffset = 0;
  private readonly _freeSlots: UniformSlot[] = [];

  constructor(device: GPUDevice, initialChunkSize: number, label = 'UniformPool') {
    this._device = device;
    // WebGPU requires uniform buffer offsets aligned to minUniformBufferOffsetAlignment (usually 256)
    this._alignment = device.limits.minUniformBufferOffsetAlignment;
    this._chunkSize = initialChunkSize;
    this._chunks.push(this._createChunk(label));
  }

  /**
   * Allocates an aligned slice of `size` bytes.
   * Returns a recycled slot from the freelist when available; otherwise carves from the current chunk,
   * growing into a new chunk if necessary.
   * The returned `size` is rounded up to the alignment boundary.
   */
  allocate(size: number): UniformSlot {
    if (this._freeSlots.length > 0) return this._freeSlots.pop()!;

    const aligned = Math.ceil(size / this._alignment) * this._alignment;

    if (this._nextOffset + aligned > this._chunkSize) {
      this._chunks.push(this._createChunk('UniformPool-chunk'));
      this._nextOffset = 0;
    }

    const chunk = this._chunks[this._chunks.length - 1];
    const slot: UniformSlot = { buffer: chunk, offset: this._nextOffset, size: aligned };
    this._nextOffset += aligned;
    return slot;
  }

  /** Returns a previously allocated slot to the freelist so it can be reused. */
  free(slot: UniformSlot): void {
    this._freeSlots.push(slot);
  }

  /**
   * Writes `data` into the slot's region of its chunk buffer.
   * @param slot      - slot returned by `allocate()`
   * @param data      - typed array to upload
   * @param srcOffset - element offset within `data` to start reading from (default 0);
   *                    measured in elements (not bytes) per the WebGPU writeBuffer spec
   */
  write(slot: UniformSlot, data: Float32Array | Uint32Array, srcOffset = 0): void {
    this._device.queue.writeBuffer(slot.buffer, slot.offset, data as Float32Array<ArrayBuffer>, srcOffset);
  }

  destroy(): void {
    for (const chunk of this._chunks) chunk.destroy();
  }

  private _createChunk(label: string): GPUBuffer {
    return this._device.createBuffer({
      label,
      size: this._chunkSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}
