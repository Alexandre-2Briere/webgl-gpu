# Buffers

## Role

Thin wrappers around `GPUBuffer` objects. Each type maps to a specific WebGPU usage pattern. The rest of the engine never calls `device.createBuffer()` directly — all GPU memory allocation goes through these classes.

## Key Concepts

- **VertexBuffer**: Holds interleaved vertex data for rendering. Fixed size at creation. Written by CPU via `queue.writeBuffer()`.
- **StorageBuffer**: Writable by both CPU (`queue.writeBuffer()`) and compute shaders (`STORAGE` flag). Not readable back by CPU (no `COPY_SRC`). Used for voxel/scalar field data passed into compute shaders.
- **IndirectBuffer**: Holds a 16-byte `drawIndirect` argument block. The compute shader atomically writes the vertex count; the render pass reads it via `drawIndirect`. Must be zeroed before each compute pass.
- **UniformPool**: A single large `GPUBuffer` sub-allocated in aligned slots. Used for per-object and per-camera uniforms. Linear allocator — no slot deallocation.

## Invariants

- All buffers are fixed-size after construction; there is no dynamic growth.
- `UniformPool` alignment follows `device.limits.minUniformBufferOffsetAlignment` (typically 256 bytes). Every allocated slot is rounded up to this boundary.
- `IndirectBuffer` initial state: `[0, 1, 0, 0]` — vertex count 0, instance count 1, first vertex 0, first instance 0. A draw without a prior compute pass draws nothing, safely.
- `UniformPool` throws if the next allocation would exceed the buffer's total capacity. The pool is pre-sized at engine startup to fit the maximum expected object count.
- `StorageBuffer` has no `COPY_SRC` flag — it cannot be mapped or read back to CPU.

## Edge Cases

- **IndirectBuffer stale count**: If `reset()` is not called before the compute pass, the vertex count from the prior frame persists. The next indirect draw will render stale geometry with the wrong vertex count.
- **UniformPool overflow**: Allocating beyond capacity throws a hard error. The pool does not wrap, grow, or silently drop the request.
- **VertexBuffer / StorageBuffer write past end**: `queue.writeBuffer()` does not bounds-check at the WebGPU API level in all implementations. Writing past the buffer end is undefined behavior — may silently corrupt neighboring GPU memory or trigger a validation layer error.
- **UniformPool slot reuse**: Slots are never freed. Creating and destroying many objects in a loop will exhaust the pool even if the objects are short-lived.
- **Zero-size buffer**: Creating a buffer of size 0 is technically valid in WebGPU but some drivers reject it. All callers should ensure at least 1 byte is requested.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| `IndirectBuffer.reset()` not called each frame | Silent — stale geometry rendered |
| `UniformPool` exhausted | Loud — throws |
| Write past `VertexBuffer` or `StorageBuffer` end | Silent GPU UB / driver-dependent |
| `StorageBuffer` read back attempt | Will throw — no `MAP_READ` flag |
| Multiple allocations from exhausted pool | Loud — throws on overflow |

## Test Scenarios

- **UniformPool overflow**: allocate slots until capacity is exactly filled, then request one more — expect throw.
- **UniformPool alignment**: verify each returned slot's `offset` is a multiple of the device's `minUniformBufferOffsetAlignment`.
- **UniformPool sequential allocation**: allocate N slots, verify offsets are contiguous and non-overlapping.
- **IndirectBuffer initial state**: create one, verify the raw bytes are `[0, 1, 0, 0]`.
- **IndirectBuffer reset**: write a non-zero vertex count, call `reset()`, verify vertex count byte is 0 and instance count is still 1.
- **VertexBuffer write**: create a buffer of N bytes, write M ≤ N bytes at offset, verify no throw.
- **StorageBuffer flags**: verify `STORAGE` and `COPY_DST` are set; verify `MAP_READ` is not set.
