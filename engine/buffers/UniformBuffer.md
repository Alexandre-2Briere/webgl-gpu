# UniformBuffer

`UniformBuffer` acts as a base class for hosting typed uniform data in WebGPU. It encapsulates standard initialization mechanics and couples the underlying `GPUBuffer` with a pre-instantiated, single-entry `GPUBindGroup` at binding `0` for cleaner application logic.

---

## Technical Shape

* **GPU Usage Flags**: `GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST`
* **Internal Structure**: Fully concrete base class that creates and maintains:
  * `protected readonly _device: GPUDevice`
  * `protected readonly _gpuBuffer: GPUBuffer`
  * `readonly bindGroup: GPUBindGroup` containing a single entry bound to offset `0`, full buffer size at binding `0`.

---

## Detailed WebGPU Usage Explanation

In WebGPU, any uniform buffer used in a shader requires a `GPUBindGroup` to tell the pipeline how to bind it. Repeating this setup for every individual uniform becomes extremely verbose. `UniformBuffer` resolves this boilerplate by creating both the buffer and its initial bind group simultaneously during instantiation.

Its subclasses inherit this layout and can simply write updated binary fields directly to the GPU via the standard protected `_write(queue, arrayBuffer)` helper.

---

## Code Example

### Direct usage (as-is):
```typescript
import { UniformBuffer } from './UniformBuffer';

// 1. Create layout
const uniformLayout = device.createBindGroupLayout({
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.VERTEX,
    buffer: { type: 'uniform' }
  }]
});

// 2. Instantiate UniformBuffer
const uniformBuf = new UniformBuffer(device, 64, uniformLayout, 'ViewportUniforms');

// 3. Write raw data using subclassing or manual structures
const array = new Float32Array(16); // 16 floats (e.g. projection matrix)
// (With direct inheritance/access helper write)
device.queue.writeBuffer(uniformBuf.bindGroup.getResource().buffer, 0, array);

// 4. Pass the pre-built bind group directly to your Render Pass
renderPass.setBindGroup(0, uniformBuf.bindGroup);
```

### Via Subclassing (Recommended design):
```typescript
import { UniformBuffer } from './UniformBuffer';

class CameraUniforms extends UniformBuffer {
  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    super(device, 64, layout, 'camera-uniform');
  }

  updateCameraMatrices(queue: GPUQueue, viewMatrix: Float32Array) {
    // viewMatrix is 16 floats (64 bytes)
    this._write(queue, viewMatrix.buffer);
  }
}
```
