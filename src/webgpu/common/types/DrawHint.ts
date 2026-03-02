// WHY: DrawHint is used to communicate buffer update frequency to the mesh layer.
// In WebGPU, both STATIC and DYNAMIC buffers use the same flags (VERTEX | COPY_DST),
// but the difference is in how often we call writeBuffer. We keep the enum for API clarity.
export enum DrawHint {
    STATIC = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,   // Rarely updated
    DYNAMIC = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,  // Frequently updated (e.g., on sculpt)
}
