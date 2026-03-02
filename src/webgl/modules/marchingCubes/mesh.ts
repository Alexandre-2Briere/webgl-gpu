// src/modules/marchingCubes/marchingCubesMesh.ts

import { MarchingCubesResult } from './types/MarchingCubesResult';
import { VERTEX_COMPONENTS, BUFFER_OFFSET, BUFFER_STRIDE } from '../../common/constants/constants';
import { DrawHint } from '../../common/types/DrawHint';

export class MarchingCubesMesh {
    private readonly vertexBuffer: WebGLBuffer;
    private readonly gl: WebGL2RenderingContext;
    private vertexCount: number;

    constructor(gl: WebGL2RenderingContext, result: MarchingCubesResult) {
        this.gl = gl;
        this.vertexCount = result.vertexCount;

        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new Error('Failed to create WebGL vertex buffer');
        }

        this.vertexBuffer = buffer;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, result.vertices, DrawHint.STATIC);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    bind(attributeLocation: number): void {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.enableVertexAttribArray(attributeLocation);
        this.gl.vertexAttribPointer(
            attributeLocation,
            VERTEX_COMPONENTS,
            this.gl.FLOAT,
            false, // normalise buffer
            BUFFER_STRIDE,
            BUFFER_OFFSET
        );
    }

    draw(): void {
        this.gl.drawArrays(this.gl.TRIANGLES, BUFFER_OFFSET, this.vertexCount);
    }

    // WHY: DYNAMIC_DRAW hints to the GPU driver that this buffer will be
    // re-uploaded frequently (e.g. on every chunk rebuild triggered by
    // field changes). Using STATIC_DRAW for a buffer that is regularly
    // rewritten causes a CPU-GPU pipeline stall on some drivers because
    // the driver may place the buffer in read-optimised (slow-write) VRAM.
    // DYNAMIC_DRAW lets the driver use write-optimised memory instead.
    update(result: MarchingCubesResult): void {
        this.vertexCount = result.vertexCount;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, result.vertices, DrawHint.DYNAMIC);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    destroy(): void {
        this.gl.deleteBuffer(this.vertexBuffer);
    }
}