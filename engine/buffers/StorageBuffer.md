# StorageBuffer

`StorageBuffer` is a wrapper around a WebGPU buffer designed for general-purpose storage buffer operations (`GPUBufferUsage.STORAGE`). It supports CPU-to-GPU data writes and contains specialized logic to handle uploading TypedArray slices.

---

## Technical Shape

* **GPU Usage Flags**: `GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`
* **Internal Layout**: Arbitrary structure depending on backing struct, defined by client. Allows larger payload limits compared to Uniform Buffers.
* **Specialized Write Logic**: Uses exact byte tracking (`writeBuffer` using array offsets and slice sizes), guaranteeing that typed array views/subarrays write only their focused section to the GPU instead of uploading from the start of the backing array.

---

## Detailed WebGPU Usage Explanation

WebGPU storage buffers are read-write inside compute shaders and read-only or read-write in fragment/vertex/compute stages. They can bypass the small `64KB` uniform buffer size limit, making them perfect for passing bulky structured parameters like instance model matrices, vertex bones, or custom scene entities.

Our `StorageBuffer` class provides a simple `write` method that handles any subarray mapping seamlessly:
```typescript
device.queue.writeBuffer(
  this._buffer, 
  offsetBytes, 
  data.buffer, 
  data.byteOffset, 
  data.byteLength
);
```

---

## Code Example

```typescript
import { StorageBuffer } from './StorageBuffer';

// 1. Instantiate StorageBuffer with desired byte size (e.g. 1024 bytes)
const myStorageBuffer = new StorageBuffer(device, 1024, 'MeshInstances');

// 2. Prepare structured data
const data = new Float32Array([1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]); // Sample transform data

// 3. Write data at offset (0 bytes default)
myStorageBuffer.write(data, 0);

// For a subarray slice, only the sliced window is written automatically
const fullArray = new Float32Array(50);
const slice = fullArray.subarray(10, 20); // 10 elements
myStorageBuffer.write(slice, 64); // Writes 10 elements starting from byte offset 64

// 4. Bind inside pipeline
const bindGroup = device.createBindGroup({
  layout: myStorageBindGroupLayout,
  entries: [{
    binding: 0,
    resource: { buffer: myStorageBuffer.buffer }
  }]
});

// 5. Cleanup
myStorageBuffer.destroy();
```
