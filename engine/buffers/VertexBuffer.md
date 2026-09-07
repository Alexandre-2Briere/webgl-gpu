# VertexBuffer

`VertexBuffer` handles vertex-specific float datasets (such as 3D position, texture coordinates, or normal arrays). It manages dynamic data uploads cleanly using standard offset coordinates on the GPU.

---

## Technical Shape

* **GPU Usage Flags**: `GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST`
* **Internal Layout**: Structured arrays representing vertex descriptors (e.g., interleaved positions `XYZ`, texture coordinates `UV`, and normal vectors `NX NY NZ`).
* **Offset Write Precision**: Inherits accurate view-origin array slicing, allowing write commands on sub-portions of pre-arranged data.

---

## Detailed WebGPU Usage Explanation

Vertex buffers are bound to render pipelines at index `0` or custom layouts during rendering passes. Just like storage buffers, our `VertexBuffer` includes logical offset writing using raw byte length slices (`byteOffset`, `byteLength`) to prevent improper array origin indexing when loading raw Float32Array components or writing dynamic sub-mesh views.

---

## Code Example

```typescript
import { VertexBuffer } from './VertexBuffer';

// 1. Setup sample vertices: interleated 3D position (3f) and UV (2f)
// 5 floats per vertex * 3 vertices = 15 floats (60 bytes)
const vertices = new Float32Array([
   0.0,  0.5, 0.0,   0.5, 0.0, // Pos, UV
  -0.5, -0.5, 0.0,   0.0, 1.0,
   0.5, -0.5, 0.0,   1.0, 1.0,
]);

// 2. Instantiate VertexBuffer
const vertexBuffer = new VertexBuffer(device, vertices.byteLength, 'TriangleVertexBuffer');

// 3. Write data to WebGPU
vertexBuffer.write(vertices, 0);

// 4. Use in Render Pass
const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
renderPass.setPipeline(renderPipeline);

// Bind vertex buffer to slot 0
renderPass.setVertexBuffer(0, vertexBuffer.buffer);
renderPass.draw(3);
renderPass.end();

// 5. Cleanup
vertexBuffer.destroy();
```
