/**
 * @file StorageBuffer.ts
 * @description Standardized container wrapping a Storage GPUBuffer (GPUBufferUsage.STORAGE)
 * designed for general purpose read-write GPU datasets.
 * 
 * Shape / Layout:
 *   - Flexible, size specified by client on initialization.
 * 
 * GPU Usage Flags:
 *   - STORAGE  -> Read-write or read-only inside shaders
 *   - COPY_DST -> Dynamic CPU to GPU data writes
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [StorageBuffer.md](StorageBuffer.md)
 * 
 * @internal
 */

export class StorageBuffer {
  // --- Instance Fields ---
  private readonly _device: GPUDevice;
  private readonly _buffer: GPUBuffer;

  // --- Constructor ---
  /**
   * Creates a new instance of StorageBuffer.
   * @param device - The active GPUDevice.
   * @param byteSize - The explicit size in bytes of the allocated buffer.
   * @param label - Optional identification label.
   */
  constructor(device: GPUDevice, byteSize: number, label?: string) {
    this._device = device;
    this._buffer = device.createBuffer({
      label,
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  // --- Getters / Setters ---
  /**
   * Reference to the underlying GPUBuffer resource.
   */
  get buffer(): GPUBuffer {
    return this._buffer;
  }

  /**
   * Total size in bytes of the underlying GPUBuffer resource.
   */
  get size(): number {
    return this._buffer.size;
  }

  // --- Public Methods ---
  /**
   * Writes the provided typed dataset to the buffer on the GPU at target byte offset.
   * Handles backing buffer slices/subarrays properly to avoid offset mismatches.
   * @param data - Float32Array or Uint32Array view containing the dataset to upload.
   * @param offsetBytes - Byte offset in the destination GPUBuffer (defaults to 0).
   */
  write(data: Float32Array | Uint32Array, offsetBytes = 0): void {
    this._device.queue.writeBuffer(
      this._buffer, 
      offsetBytes, 
      data.buffer, 
      data.byteOffset, 
      data.byteLength
    );
  }

  /**
   * Reclaims and frees the GPU memory occupied by this buffer.
   */
  destroy(): void {
    this._buffer.destroy();
  }
}

