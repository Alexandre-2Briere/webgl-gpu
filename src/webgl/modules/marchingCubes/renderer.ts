// src/modules/marchingCubes/marchingCubesRenderer.ts

import { Camera } from '../../common/utils/camera/camera';
import { identityMatrix4 } from '../../common/constants/matrix';
import { VERTEX_SOURCE } from './shaders/vertexShader';
import { FRAGMENT_SOURCE } from './shaders/fragmentShader';
import { OVERLAY_VERT_SOURCE } from './shaders/overlayVertShader';
import { OVERLAY_FRAG_SOURCE } from './shaders/overlayFragShader';
import { CROSSHAIR_VERT_SOURCE } from './shaders/crosshairVertShader';
import { CROSSHAIR_FRAG_SOURCE } from './shaders/crosshairFragShader';
import { ProgramLocations } from './types/programLocations';
import { compileShaderCustom, getProgramLocations } from './shaders/shaderCompiler';
import { ISO_LEVEL, UNIFORM_VECTOR3, SCULPT_RADIUS } from './constants/general';
import { BACKGROUND_COLOR } from './constants/color';
import { World } from './scene/world';
import { createPerlinFill } from './utils/fillPerlin';
import { GL_LIMITS } from '../../common/constants/maximumVal';

// Raycast distance: how far the crosshair checks for a hovered triangle.
const RAYCAST_MAX_DIST = 20;

// Reusable typed arrays — avoids per-frame allocation in render().
const RED_COLOR  = new Float32Array([1.0, 0.0, 0.0, 1.0]);
const HIGHLIGHT_VERTS = new Float32Array(9); // 3 world-space vertices, updated each frame

export class MarchingCubesRenderer {
    private readonly gl: WebGL2RenderingContext;

    // --- Terrain program (existing) ---
    private readonly program: WebGLProgram;
    private readonly locations: ProgramLocations;

    // --- Overlay program: draws the hovered triangle in red ---
    private readonly overlayProgram: WebGLProgram;
    private readonly overlayPositionLoc: number;
    private readonly overlayViewLoc: WebGLUniformLocation;
    private readonly overlayProjLoc: WebGLUniformLocation;
    private readonly overlayColorLoc: WebGLUniformLocation;
    // WHY DYNAMIC_DRAW: this buffer is rewritten every frame with the 3 vertices
    // of whichever triangle the crosshair is pointing at.
    private readonly highlightVBO: WebGLBuffer;

    // --- Crosshair program: draws a white dot at clip-space centre ---
    private readonly crosshairProgram: WebGLProgram;

    private camera: Camera;
    private world: World;

    // WHY: the last ray-triangle hit point is computed inside render() where
    // the ray is already built. Storing it as plain number fields (no object
    // allocation) lets sculpt() consume it synchronously on the same frame
    // tick without re-casting the ray.
    private lastHitX: number = 0;
    private lastHitY: number = 0;
    private lastHitZ: number = 0;
    private hasHit: boolean  = false;

    getCamera(): Camera {
        return this.camera;
    }

    constructor(canvas: HTMLCanvasElement) {
        // WHY: WebGL2 context is required (not WebGL1) because the shaders use
        // GLSL ES 3.00 features: `in`/`out` I/O qualifiers, `dFdx`/`dFdy`
        // derivative functions for on-the-fly flat-normal computation, and
        // `#version 300 es`. None of these are available in WebGL1 / GLSL ES 1.00.
        const gl = canvas.getContext('webgl2');
        if (!gl) {
            throw new Error('WebGL2 is not supported in this browser');
        }
        this.gl = gl;

        this.camera = new Camera();

        // --- Terrain program ---
        this.program = compileShaderCustom(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
        this.locations = getProgramLocations(gl, this.program);

        // --- Overlay program ---
        this.overlayProgram = compileShaderCustom(gl, OVERLAY_VERT_SOURCE, OVERLAY_FRAG_SOURCE);
        this.overlayPositionLoc = gl.getAttribLocation(this.overlayProgram, 'aPosition');
        this.overlayViewLoc     = gl.getUniformLocation(this.overlayProgram, 'uViewMatrix')!;
        this.overlayProjLoc     = gl.getUniformLocation(this.overlayProgram, 'uProjectionMatrix')!;
        this.overlayColorLoc    = gl.getUniformLocation(this.overlayProgram, 'uColor')!;

        const highlightVBO = gl.createBuffer();
        if (!highlightVBO) throw new Error('Failed to create highlight VBO');
        this.highlightVBO = highlightVBO;
        gl.bindBuffer(gl.ARRAY_BUFFER, highlightVBO);
        gl.bufferData(gl.ARRAY_BUFFER, HIGHLIGHT_VERTS, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // --- Crosshair program ---
        this.crosshairProgram = compileShaderCustom(gl, CROSSHAIR_VERT_SOURCE, CROSSHAIR_FRAG_SOURCE);

        const fill = createPerlinFill({
            scale: 0.05,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0,
            threshold: 0.0,
        });

        this.world = new World(this.gl, fill, ISO_LEVEL);

        gl.enable(gl.DEPTH_TEST);

        this.handleResize();
    }

    private handleResize(): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width === width && canvas.height === height) return;

        if (width > GL_LIMITS.MAX_VIEWPORT_DIMS[0] || height > GL_LIMITS.MAX_VIEWPORT_DIMS[1]) {
            throw new Error(`Viewport ${width}×${height} exceeds GL_LIMITS.MAX_VIEWPORT_DIMS [${GL_LIMITS.MAX_VIEWPORT_DIMS}]`);
        }

        canvas.width = width;
        canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.camera.setAspectRatio(width, height);
    }

    render(): void {
        // WHY: handleResize() is called every frame instead of wiring a
        // ResizeObserver. The cost is two canvas property reads per frame —
        // negligible compared to the GPU draw calls — and it avoids the
        // complexity of managing an observer lifecycle and its callback timing.
        this.handleResize();

        const gl = this.gl;

        gl.clearColor(BACKGROUND_COLOR.red, BACKGROUND_COLOR.green, BACKGROUND_COLOR.blue, BACKGROUND_COLOR.alpha);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // ------------------------------------------------------------------ //
        // 1. Main terrain pass
        // ------------------------------------------------------------------ //
        gl.useProgram(this.program);

        const viewMatrix       = this.camera.getViewMatrix();
        const projectionMatrix = this.camera.getProjectionMatrix();

        gl.uniformMatrix4fv(this.locations.uniforms.modelMatrix,      false, identityMatrix4);
        gl.uniformMatrix4fv(this.locations.uniforms.viewMatrix,        false, viewMatrix);
        gl.uniformMatrix4fv(this.locations.uniforms.projectionMatrix,  false, projectionMatrix);
        gl.uniform3fv(this.locations.uniforms.lightDirection, UNIFORM_VECTOR3);

        this.world.render(
            this.locations.attributes.position,
            this.locations.uniforms.chunkOffset,
            viewMatrix,
            projectionMatrix,
        );

        // ------------------------------------------------------------------ //
        // 2. Highlight the hovered triangle in red
        //
        // WHY polygon offset: the highlighted triangle sits exactly on the
        // terrain surface. Without an offset the depth values are identical and
        // the result is z-fighting (flickering). polygonOffset(-1, -1) pulls the
        // highlighted triangle slightly toward the camera so it always wins the
        // depth test against the terrain geometry behind it.
        // ------------------------------------------------------------------ //

        // Compute the camera forward ray (same formula as camera.ts getViewMatrix).
        const yaw   = this.camera.yaw;
        const pitch = this.camera.pitch;
        const rayDX = Math.sin(yaw) * Math.cos(pitch);
        const rayDY = Math.sin(pitch);
        const rayDZ = -Math.cos(yaw) * Math.cos(pitch);

        const hit = this.world.raycastTriangle(
            this.camera.positionX, this.camera.positionY, this.camera.positionZ,
            rayDX, rayDY, rayDZ,
            RAYCAST_MAX_DIST,
        );

        if (hit) {
            // Cache hit point so sculpt() can use it without re-casting the ray.
            this.lastHitX = this.camera.positionX + rayDX * hit.t;
            this.lastHitY = this.camera.positionY + rayDY * hit.t;
            this.lastHitZ = this.camera.positionZ + rayDZ * hit.t;
            this.hasHit = true;

            // Upload the 3 world-space triangle vertices into the dynamic VBO.
            HIGHLIGHT_VERTS.set(hit.vertices);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.highlightVBO);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, HIGHLIGHT_VERTS);

            gl.useProgram(this.overlayProgram);
            gl.uniformMatrix4fv(this.overlayViewLoc, false, viewMatrix);
            gl.uniformMatrix4fv(this.overlayProjLoc, false, projectionMatrix);
            gl.uniform4fv(this.overlayColorLoc, RED_COLOR);

            gl.enableVertexAttribArray(this.overlayPositionLoc);
            gl.vertexAttribPointer(this.overlayPositionLoc, 3, gl.FLOAT, false, 0, 0);

            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(-1, -1);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.disable(gl.POLYGON_OFFSET_FILL);

            gl.disableVertexAttribArray(this.overlayPositionLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else {
            this.hasHit = false;
        }

        // ------------------------------------------------------------------ //
        // 3. Crosshair dot
        //
        // WHY depth test disabled: the dot must always be visible on top of the
        // scene. If depth testing were left on the point would be at z=0 in NDC
        // (the near plane) and could be occluded by terrain that writes z < 0.5.
        // ------------------------------------------------------------------ //
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(this.crosshairProgram);
        gl.drawArrays(gl.POINTS, 0, 1);
        gl.enable(gl.DEPTH_TEST);
    }

    /**
     * Apply a sculpt operation at the last ray-triangle hit point recorded by
     * the most recent render() call. Positive delta adds material; negative
     * removes it. Does nothing if the crosshair is not aimed at any triangle.
     */
    sculpt(delta: number): void {
        if (!this.hasHit) return;
        this.world.sculptAt(this.lastHitX, this.lastHitY, this.lastHitZ, SCULPT_RADIUS, delta);
    }

    collidesWithAABB(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): boolean {
        return this.world.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    destroy(): void {
        this.world.destroy();
        this.gl.deleteProgram(this.program);
        this.gl.deleteProgram(this.overlayProgram);
        this.gl.deleteProgram(this.crosshairProgram);
        this.gl.deleteBuffer(this.highlightVBO);
    }
}
