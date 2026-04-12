/** @internal */
export class PipelineCache {
  private readonly _device: GPUDevice;
  private readonly _renderPipelines = new Map<string, GPURenderPipeline>();
  private readonly _computePipelines = new Map<string, GPUComputePipeline>();

  constructor(device: GPUDevice) {
    this._device = device;
  }

  getOrCreateRender(key: string, descriptor: GPURenderPipelineDescriptor): GPURenderPipeline {
    let pipeline = this._renderPipelines.get(key);
    if (!pipeline) {
      pipeline = this._device.createRenderPipeline(descriptor);
      this._renderPipelines.set(key, pipeline);
    }
    return pipeline;
  }

  getOrCreateCompute(key: string, descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
    let pipeline = this._computePipelines.get(key);
    if (!pipeline) {
      pipeline = this._device.createComputePipeline(descriptor);
      this._computePipelines.set(key, pipeline);
    }
    return pipeline;
  }

  /** Simple djb2 hash — used to derive a stable key from WGSL source. */
  static hashSource(source: string): string {
    let h = 5381;
    for (let i = 0; i < Math.min(source.length, 2048); i++) {
      h = ((h << 5) + h) ^ source.charCodeAt(i);
      h = h >>> 0;  // keep unsigned 32-bit
    }
    return h.toString(16);
  }
}
