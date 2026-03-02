// src/modules/marchingCubes/mesh.ts

import { MarchingCubesResult } from './types/MarchingCubesResult';
import { VERTEX_COMPONENTS } from '../../common/constants/constants';

// WHY: MarchingCubesMesh wraps a GPUBuffer and tracks vertex count.
// Unlike WebGL, we don't have a separate bind() step; the renderer sets
// the buffer and calls draw() with the vertex count. This is simpler and
// avoids the WebGL VAO/attribute pointer complexity.

export class MarchingCubesMesh {
    private vertexBuffer: GPUBuffer;
    private readonly device: GPUDevice;
    private vertexCount: number;

    constructor(device: GPUDevice, result: MarchingCubesResult) {
        this.device = device;
        this.vertexCount = result.vertexCount;

        // WHY: We allocate with a generous size to avoid reallocating on every sculpt.
        // This assumes sculpted chunks won't exceed 2x their initial vertex count.
        // If they do, we'll reallocate (which is rare in typical sculpting).
        const initialSize = result.vertices.byteLength;

        this.vertexBuffer = device.createBuffer({
            size: initialSize * 2,  // Pre-allocate with headroom
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });

        // Copy initial vertex data
        new Float32Array(this.vertexBuffer.getMappedRange()).set(
            new Float32Array(result.vertices)
        );
        this.vertexBuffer.unmap();
    }

    /**
     * Get the vertex buffer for binding in a render pass.
     * WHY: The renderer will call setVertexBuffer() once per chunk before drawing.
     */
    getBuffer(): GPUBuffer {
        return this.vertexBuffer;
    }

    /**
     * Get the vertex count (used in draw() call).
     */
    getVertexCount(): number {
        return this.vertexCount;
    }

    /**
     * Update the vertex buffer with new marching cubes data.
     * WHY: This is called when a chunk is sculpted. We use queue.writeBuffer
     * which is asynchronous and GPU-friendly; the GPU can process the previous
     * frame while we're uploading new data.
     */
    update(result: MarchingCubesResult): void {
        this.vertexCount = result.vertexCount;

        // If the new data is too large, reallocate the buffer.
        if (result.vertices.byteLength > this.vertexBuffer.size) {
            console.warn(
                `Mesh overflow: reallocating from ${this.vertexBuffer.size} to ${result.vertices.byteLength * 2}`
            );
            this.vertexBuffer.destroy();
            // Create a new buffer (simplified here; full implementation would use object pool)
            this.vertexBuffer = this.device.createBuffer({
                size: result.vertices.byteLength * 2,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(this.vertexBuffer.getMappedRange()).set(
                new Float32Array(result.vertices)
            );
            this.vertexBuffer.unmap();
        } else {
            // Normal case: write within the existing buffer
            this.device.queue.writeBuffer(
                this.vertexBuffer,
                0,
                result.vertices,
                0,
                result.vertexCount * VERTEX_COMPONENTS
            );
        }
    }

    /**
     * Destroy the GPU buffer.
     */
    destroy(): void {
        this.vertexBuffer.destroy();
    }
}
