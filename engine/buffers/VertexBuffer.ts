/**
 * @file VertexBuffer.ts
 * @description Standardized container wrapping a Vertex GPUBuffer (GPUBufferUsage.VERTEX)
 * designed for storing vertex attribute data (positions, UVs, normals).
 * 
 * Shape / Layout:
 *   - Structured arrays representing vertex attributes, size specified by client on initialization.
 * 
 * GPU Usage Flags:
 *   - VERTEX   -> Raw vertex stage index buffer bindings
 *   - COPY_DST -> Dynamic CPU to GPU data writes
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [VertexBuffer.md](VertexBuffer.md)
 * 
 * @internal
 */

export class VertexBuffer {
  // --- Instance Fields ---
  private readonly _device: GPUDevice;
  private readonly _buffer: GPUBuffer;

  // --- Constructor ---
  /**
   * Creates a new instance of VertexBuffer.
   * @param device - active GPUDevice.
   * @param byteSize - The explicit size in bytes of the allocated buffer.
   * @param label - Optional identification label.
   */
  constructor(device: GPUDevice, byteSize: number, label?: string) {
    this._device = device;
    this._buffer = device.createBuffer({
      label,
      size: byteSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
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
   * Uploads raw vertex attribute data to the buffer on the GPU.
   * Handles backing buffer slices/subarrays properly to avoid offset mismatches.
   * @param data - Float32Array view containing vertex attribute data.
   * @param offsetBytes - Byte offset in the destination GPUBuffer (defaults to 0).
   */
  write(data: Float32Array, offsetBytes = 0): void {
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

