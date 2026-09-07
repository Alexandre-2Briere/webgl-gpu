/**
 * @file UniformPool.ts
 * @description Manages dynamic suballocations of 256-byte aligned slices from large
 * unified GPUBuffer chunks, featuring dynamic expansion of blocks and recycling of freed slots.
 * 
 * Shape / Layout:
 *   - Auto-grows dynamically with incremental allocations.
 *   - Follows system platform offset alignments determined by minUniformBufferOffsetAlignment.
 * 
 * GPU Usage Flags:
 *   - UNIFORM  -> Serves sub-allocated uniforms
 *   - COPY_DST -> Dynamic CPU to GPU data writes on specific slots
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [UniformPool.md](UniformPool.md)
 * 
 * @internal
 */

/**
 * Represents a single suballocated memory segment within the broader UniformPool chain.
 * @internal
 */
export interface UniformSlot {
  buffer: GPUBuffer;
  offset: number;
  size: number;
}

/** @internal */
export class UniformPool {
  // --- Instance Fields ---
  private readonly _device: GPUDevice;
  private readonly _alignment: number;
  private readonly _chunkSize: number;
  private readonly _chunks: GPUBuffer[] = [];
  private readonly _freeSlots: UniformSlot[] = [];
  private _nextOffset = 0;

  // --- Constructor ---
  /**
   * Creates a new instance of UniformPool.
   * @param device - The active GPUDevice.
   * @param initialChunkSize - Byte size limits of each memory chunk (e.g. 64KB).
   * @param label - Optional identification label.
   */
  constructor(device: GPUDevice, initialChunkSize: number, label = 'UniformPool') {
    this._device = device;
    // WebGPU requires uniform buffer offsets aligned to minUniformBufferOffsetAlignment (usually 256)
    this._alignment = device.limits.minUniformBufferOffsetAlignment;
    this._chunkSize = initialChunkSize;
    this._chunks.push(this._createChunk(label));
  }

  // --- Public Methods ---
  /**
   * Allocates an aligned slice from the pool.
   * Recycles an existing slot from the internal freelist if available, otherwise carves
   * space from the active memory chunk, dynamically allocating a new chunk if necessary.
   * The requested size is rounded up to the systems minUniformBufferOffsetAlignment.
   * @param size - Minimum byte size required for the uniform slot allocation.
   * @returns A UniformSlot targeting the aligned segment.
   */
  allocate(size: number): UniformSlot {
    if (this._freeSlots.length > 0) {
      return this._freeSlots.pop()!;
    }

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

  /**
   * Returns a previously allocated slot to the internal freelist for subsequent reuse.
   * @param slot - The UniformSlot to free.
   */
  free(slot: UniformSlot): void {
    this._freeSlots.push(slot);
  }

  /**
   * Writes typed array data directly into the allocated memory slot.
   * @param slot - Target slot allocated via the pool.
   * @param data - The typed Float32Array or Uint32Array to write.
   * @param srcOffset - Element offset within source data to start reading (defaults to 0).
   */
  write(slot: UniformSlot, data: Float32Array | Uint32Array, srcOffset = 0): void {
    this._device.queue.writeBuffer(slot.buffer, slot.offset, data as Float32Array<ArrayBuffer>, srcOffset);
  }

  /**
   * Reclaims and frees all GPU memory occupied by the chunk buffers managed by this pool.
   */
  destroy(): void {
    for (const chunk of this._chunks) {
      chunk.destroy();
    }
  }

  // --- Private Methods ---
  private _createChunk(label: string): GPUBuffer {
    return this._device.createBuffer({
      label,
      size: this._chunkSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}

