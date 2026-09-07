# IndirectBuffer

`IndirectBuffer` manages a 16-byte GPU buffer that holds draw arguments for indirect rendering. It is designed to be written by a WebGPU Compute Shader and subsequently consumed by a Render Pass draw call.

---

## Technical Shape

* **Buffer Size**: 16 bytes
* **GPU Usage Flags**: `GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`
* **Internal Layout (binary alignment)**:
  * Offset `0` (4 bytes): `vertexCount` (`u32`) - Number of vertices to draw. Usually written dynamically by a compute shader.
  * Offset `4` (4 bytes): `instanceCount` (`u32`) - Number of instances to draw (initialized/remains `1` by default).
  * Offset `8` (4 bytes): `firstVertex` (`u32`) - Offset index in the vertex buffer (initialized/remains `0`).
  * Offset `12` (4 bytes): `firstInstance` (`u32`) - Offset index of the first instance (initialized/remains `0`).

---

## Detailed WebGPU Usage Explanation

Indirect buffers are critical for GPU-driven rendering techniques (such as occlusion culling or GPU-based particle spawning). Instead of the CPU querying how many particles are visible and submitting that number back to the GPU, a compute shader processes the elements, counts the active ones, and writes that count directly to the `IndirectBuffer` at offset `0`.

The render pass then reads directly from this buffer when executing drawing commands, avoiding CPU-GPU stalls.

---

## Code Example

```typescript
import { IndirectBuffer } from './IndirectBuffer';

// 1. Initialization
const indirectBuffer = new IndirectBuffer(device, 'MyIndirectBuffer');

// 2. Pre-Compute Stage (typically done in the render loop)
// Zero out the vertex count so the compute shader starts its accumulation from 0
indirectBuffer.reset();

// 3. Compute Phase (Write count from Compute Shader)
const listComputePass = commandEncoder.beginComputePass();
listComputePass.setPipeline(computePipeline);
listComputePass.setBindGroup(0, computeBindGroupWithIndirectBufferStorage); // Binding has storage usage
listComputePass.dispatchWorkgroups(workgroupCount);
listComputePass.end();

// 4. Render Phase (Read args from IndirectBuffer)
const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
renderPass.setPipeline(renderPipeline);
renderPass.setVertexBuffer(0, vertexBuffer.buffer);

// Draw using arguments recorded in the IndirectBuffer
renderPass.drawIndirect(
  indirectBuffer.buffer, 
  0 // byte offset into the indirect buffer
);
renderPass.end();

// 5. Cleanup
indirectBuffer.destroy();
```
