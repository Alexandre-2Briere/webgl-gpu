export interface Buffer {
  readonly _buffer: GPUBuffer,
  readonly _device: GPUDevice,

  buffer(): GPUBuffer,
  reset(): void,
  destroy(): void,
  write(data: ArrayBuffer | ArrayBufferView, offset?: number): void,
}
