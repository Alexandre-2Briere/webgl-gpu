# UniformPool

`UniformPool` manages the dynamic suballocation and recycling of small uniform buffer slices from unified, large memory chunks. It handles memory growth automatically and recycling of freed slots via an internal freelist to optimize memory efficiency.

---

## Technical Shape

* **Properties**:
  * Auto-grows dynamically with incremental allocations.
  * Ensures that every suballocated slot size is aligned to the system layout capability (usually 256 bytes block offset constraints specified by `device.limits.minUniformBufferOffsetAlignment`).
* **GPU Usage Flags**: `GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST`
* **Allocation Unit Struct (`UniformSlot`)**:
  ```typescript
  interface UniformSlot {
    buffer: GPUBuffer;
    offset: number;
    size: number;
  }
  ```

---

## Detailed WebGPU Usage Explanation

WebGPU specifies a platform-dependent limit called `minUniformBufferOffsetAlignment` (normally 256 bytes). This means any dynamic or offset-based standard uniform bind group resource *must* start on a byte index that is a multiple of this value. Creating thousands of micro `64-byte` individual `GPUBuffer` allocations is extremely inefficient and incurs severe overhead.

`UniformPool` solves this problem by allocating a single large chunk (such as 64KB) and slicing it into 256-byte aligned segments (`UniformSlot`). When a game object (like a mesh renderable) is deleted, its slot is freed back to the freelist and recycled for subsequent objects, preventing CPU and GPU heap fragmentation.

---

## Code Example

```typescript
import { UniformPool, UniformSlot } from './UniformPool';

// 1. Instantiate the Pool (e.g. 64KB initial chunk size)
const pool = new UniformPool(device, 65536, 'MainUniformPool');

// 2. Allocate space for a single mesh matrix (64 bytes size)
// The slot is automatically padded up to 256-bytes alignment inside
const meshSlot: UniformSlot = pool.allocate(64);

// 3. Write transform matrix into allocated slot
const modelMatrix = new Float32Array([
  1.0, 0.0, 0.0, 0.0,
  0.0, 1.0, 0.0, 0.0,
  0.0, 0.0, 1.0, 0.0,
  10.0, 20.0, 5.0, 1.0
]);
pool.write(meshSlot, modelMatrix);

// 4. Create a bind group utilizing the slot's bounds
const bindGroup = device.createBindGroup({
  layout: meshBindGroupLayout,
  entries: [{
    binding: 0,
    resource: {
      buffer: meshSlot.buffer,
      offset: meshSlot.offset,
      size: meshSlot.size // Size is aligned correctly
    }
  }]
});

// Use during Render Pass
renderPass.setBindGroup(2, bindGroup);

// 5. Clean up when game object or sprite is disposed
pool.free(meshSlot); // Recycles for future calls!

// At end of renderer scope:
pool.destroy();
```
