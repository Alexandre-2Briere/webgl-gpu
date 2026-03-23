export type DispatchSize = [number, number, number] | (() => [number, number, number])

export class ComputePass {
  private readonly _pipeline: GPUComputePipeline
  private readonly _bindGroup: GPUBindGroup
  private _dispatchSize: DispatchSize

  constructor(
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    dispatchSize: DispatchSize,
  ) {
    this._pipeline = pipeline
    this._bindGroup = bindGroup
    this._dispatchSize = dispatchSize
  }

  setDispatchSize(size: DispatchSize): void {
    this._dispatchSize = size
  }

  encode(pass: GPUComputePassEncoder): void {
    const [x, y, z] = typeof this._dispatchSize === 'function'
      ? this._dispatchSize()
      : this._dispatchSize
    pass.setPipeline(this._pipeline)
    pass.setBindGroup(0, this._bindGroup)
    pass.dispatchWorkgroups(x, y, z)
  }
}
