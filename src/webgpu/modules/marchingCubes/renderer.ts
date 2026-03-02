// src/modules/marchingCubes/renderer.ts

import { Camera } from '../../common/utils/camera/camera';
import { identityMatrix4 } from '../../common/constants/matrix';
import {
    createTerrainPipeline,
    createOverlayPipeline,
    createCrosshairPipeline,
    PipelineBundle,
    TerrainPipelineBundle,
} from './shaders/shaderCompiler';
import { ISO_LEVEL, UNIFORM_VECTOR3, SCULPT_RADIUS, TERRAIN_SURFACE_Y } from './constants/general';
import { Vertex3 } from '../../common/types/Vertex';
import { BACKGROUND_COLOR } from './constants/color';
import { World } from './scene/world';
import { populateLimits } from '../../common/constants/maximumVal';
import { createPlaneFill } from './utils/fillPlane';

// Raycast distance: how far the crosshair checks for a hovered triangle.
const RAYCAST_MAX_DIST = 20;

// Reusable typed arrays — avoids per-frame allocation in render().
const RED_COLOR = new Float32Array([1.0, 0.0, 0.0, 1.0]);
const HIGHLIGHT_VERTS = new Float32Array(9); // 3 world-space vertices × 3 floats

// WHY: Crosshair quad in NDC space. 4 vertices, 2 triangles.
// Size is ±0.1 NDC so the inscribed circle has NDC radius 0.1.
// The fragment shader discards anything outside that circle, producing a dot.
// Each vertex is: [posX, posY, coordX, coordY]
const CROSSHAIR_QUAD = new Float32Array([
    // Triangle 1
    -0.1, -0.1, 0.0, 0.0,  // bottom-left
    0.1, -0.1, 1.0, 0.0,  // bottom-right
    -0.1, 0.1, 0.0, 1.0,  // top-left
    // Triangle 2
    -0.1, 0.1, 0.0, 1.0,  // top-left
    0.1, -0.1, 1.0, 0.0,  // bottom-right
    0.1, 0.1, 1.0, 1.0,  // top-right
]);

export class MarchingCubesRenderer {
    private readonly device: GPUDevice;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: GPUCanvasContext;

    // --- Render pipelines ---
    private readonly terrainPipeline: TerrainPipelineBundle;
    private readonly overlayPipeline: PipelineBundle;
    private readonly crosshairPipeline: PipelineBundle;

    // --- Uniform buffers ---
    // Terrain group 0 (frame-level, shared): model/view/proj matrices + light direction
    private readonly terrainUniformsBuffer0: GPUBuffer;  // 3 × mat4x4f = 192 bytes
    private readonly terrainUniformsBuffer1: GPUBuffer;  // light direction = 16 bytes
    private readonly terrainBindGroup: GPUBindGroup;     // group 0 bind group

    // Overlay: view/projection matrices + color
    private readonly overlayUniformsBuffer0: GPUBuffer;  // matrices
    private readonly overlayUniformsBuffer1: GPUBuffer;  // color
    private readonly overlayBindGroup: GPUBindGroup;

    // Highlight triangle VBO (updated each frame if ray hits)
    private readonly highlightVBO: GPUBuffer;

    // Crosshair quad VBO (static, created once)
    private readonly crosshairVBO: GPUBuffer;
    private readonly crosshairBindGroup: GPUBindGroup;

    // --- Depth texture ---
    private depthTexture: GPUTexture;

    private camera: Camera;
    private world: World;

    // WHY: Cache the last ray-triangle hit point so sculpt() can use it
    // without re-casting the ray.
    private lastHit: Vertex3 = new Vertex3(0, 0, 0);
    private hasHit: boolean = false;

    getCamera(): Camera {
        return this.camera;
    }

    /**
     * Create a WebGPU renderer asynchronously.
     * This is a static async factory because WebGPU initialization requires async/await.
     */
    static async create(canvas: HTMLCanvasElement): Promise<MarchingCubesRenderer> {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('Failed to request WebGPU adapter');
        }

        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu') as GPUCanvasContext;
        if (!context) {
            throw new Error('Failed to get WebGPU canvas context');
        }

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format: canvasFormat, alphaMode: 'opaque' });

        return new MarchingCubesRenderer(canvas, device, context, canvasFormat);
    }

    private constructor(
        canvas: HTMLCanvasElement,
        device: GPUDevice,
        context: GPUCanvasContext,
        canvasFormat: GPUTextureFormat
    ) {
        this.canvas = canvas;
        this.device = device;
        this.context = context;

        // Cache WebGPU device limits for potential future use
        populateLimits(device);

        this.camera = new Camera();

        // --- Create render pipelines ---
        this.terrainPipeline = createTerrainPipeline(device, canvasFormat);
        this.overlayPipeline = createOverlayPipeline(device, canvasFormat);
        this.crosshairPipeline = createCrosshairPipeline(device, canvasFormat);

        // --- Create uniform buffers for terrain ---
        // Buffer 0: model/view/projection matrices only (192 bytes = 3 × mat4x4f)
        // Chunk offset is now in group 1, baked into each chunk's own GPUBuffer at init.
        this.terrainUniformsBuffer0 = device.createBuffer({
            size: 192,  // 3 × mat4x4f (64 bytes each)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.terrainUniformsBuffer0.getMappedRange()).set(
            new Float32Array([
                ...identityMatrix4,
                ...this.camera.getViewMatrix(),
                ...this.camera.getProjectionMatrix(),
            ])
        );
        this.terrainUniformsBuffer0.unmap();

        // Buffer 1: light direction (16 bytes = vec3f + padding)
        this.terrainUniformsBuffer1 = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        // WHY: the 4th float reuses the mandatory vec3f padding so no extra buffer is
        // needed. surfaceY is read by the fragment shader to derive colour thresholds.
        new Float32Array(this.terrainUniformsBuffer1.getMappedRange()).set([
            UNIFORM_VECTOR3[0], UNIFORM_VECTOR3[1], UNIFORM_VECTOR3[2], TERRAIN_SURFACE_Y,
        ]);
        this.terrainUniformsBuffer1.unmap();

        // Create terrain bind group
        this.terrainBindGroup = device.createBindGroup({
            layout: this.terrainPipeline.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.terrainUniformsBuffer0 } },
                { binding: 1, resource: { buffer: this.terrainUniformsBuffer1 } },
            ],
        });

        // --- Create uniform buffers for overlay ---
        // Buffer 0: view/projection matrices (128 bytes = 2 × mat4x4f)
        this.overlayUniformsBuffer0 = device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.overlayUniformsBuffer0.getMappedRange()).set(
            new Float32Array([
                ...this.camera.getViewMatrix(),
                ...this.camera.getProjectionMatrix(),
            ])
        );
        this.overlayUniformsBuffer0.unmap();

        // Buffer 1: color (16 bytes = vec4f)
        this.overlayUniformsBuffer1 = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.overlayUniformsBuffer1.getMappedRange()).set(RED_COLOR);
        this.overlayUniformsBuffer1.unmap();

        // Create overlay bind group
        this.overlayBindGroup = device.createBindGroup({
            layout: this.overlayPipeline.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.overlayUniformsBuffer0 } },
                { binding: 1, resource: { buffer: this.overlayUniformsBuffer1 } },
            ],
        });

        // --- Create VBO for highlight triangle ---
        this.highlightVBO = device.createBuffer({
            size: HIGHLIGHT_VERTS.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.highlightVBO.getMappedRange()).set(HIGHLIGHT_VERTS);
        this.highlightVBO.unmap();

        // --- Create VBO for crosshair quad ---
        this.crosshairVBO = device.createBuffer({
            size: CROSSHAIR_QUAD.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.crosshairVBO.getMappedRange()).set(CROSSHAIR_QUAD);
        this.crosshairVBO.unmap();

        // Crosshair uses no uniforms, so bind group is empty
        this.crosshairBindGroup = device.createBindGroup({
            layout: this.crosshairPipeline.bindGroupLayout,
            entries: [],
        });

        // --- Create depth texture ---
        this.depthTexture = this.createDepthTexture();

        // --- Create world ---
        const fill = createPlaneFill({
            surfaceY: TERRAIN_SURFACE_Y,  // world Y voxel where the flat plane sits
            noiseAmplitude: 2,            // ±2 voxel surface variation
            noiseScale: 0.3,              // gentle, widely-spaced bumps
        });
        // WHY: underground chunks (cy < 0) are completely solid so the player can
        // sculpt into them and see the colour layers (dirt/stone). A constant value
        // of 1.0 keeps all voxels above ISO_LEVEL=0.3 (no triangles until sculpted)
        // while requiring only ~2 sculpt clicks at centre to carve through.
        const undergroundFill = () => 1.0;
        this.world = new World(device, this.terrainPipeline.chunkBindGroupLayout, fill, ISO_LEVEL, undergroundFill);

        this.handleResize();
    }

    private createDepthTexture(): GPUTexture {
        return this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    private handleResize(): void {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (this.canvas.width === width && this.canvas.height === height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.camera.setAspectRatio(width, height);

        // Recreate depth texture at new size
        this.depthTexture.destroy();
        this.depthTexture = this.createDepthTexture();
    }

    render(): void {
        // WHY: handleResize() is called every frame instead of a ResizeObserver.
        // The cost is negligible, and it avoids lifecycle management complexity.
        this.handleResize();

        // Update camera matrices in uniform buffers
        const viewMatrix = this.camera.getViewMatrix();
        const projectionMatrix = this.camera.getProjectionMatrix();

        // Advance the progressive chunk loader: load the next pending chunk (if any)
        // using the current camera position and frustum to drive priority.
        this.world.update(this.camera);

        // WHY: Batch uniform updates into single typed arrays before uploading.
        // This avoids GPU pipeline stalls from multiple writeBuffer calls and ensures
        // all uniforms are consistent when the render pass begins.
        const terrainUniforms = new Float32Array(48); // 192 bytes / 4 = 48 floats
        terrainUniforms.set(identityMatrix4, 0);       // 0-15: modelMatrix
        terrainUniforms.set(viewMatrix, 16);           // 16-31: viewMatrix
        terrainUniforms.set(projectionMatrix, 32);     // 32-47: projectionMatrix
        this.device.queue.writeBuffer(this.terrainUniformsBuffer0, 0, terrainUniforms);

        const overlayUniforms = new Float32Array(32); // 128 bytes / 4 = 32 floats
        overlayUniforms.set(viewMatrix, 0);            // offset 0 = viewMatrix
        overlayUniforms.set(projectionMatrix, 16);     // offset 64 = projectionMatrix
        this.device.queue.writeBuffer(this.overlayUniformsBuffer0, 0, overlayUniforms);

        // --- Raycast for highlight ---
        const yaw = this.camera.yaw;
        const pitch = this.camera.pitch;
        const rayDX = Math.sin(yaw) * Math.cos(pitch);
        const rayDY = Math.sin(pitch);
        const rayDZ = -Math.cos(yaw) * Math.cos(pitch);

        const hit = this.world.raycastTriangle(
            this.camera.positionX,
            this.camera.positionY,
            this.camera.positionZ,
            rayDX,
            rayDY,
            rayDZ,
            RAYCAST_MAX_DIST
        );

        if (hit) {
            this.lastHit = new Vertex3(
                this.camera.positionX + rayDX * hit.t,
                this.camera.positionY + rayDY * hit.t,
                this.camera.positionZ + rayDZ * hit.t,
            );
            this.hasHit = true;

            // Update highlight VBO
            HIGHLIGHT_VERTS.set(hit.vertices);
            this.device.queue.writeBuffer(this.highlightVBO, 0, HIGHLIGHT_VERTS);
        } else {
            this.hasHit = false;
        }

        // --- Render ---
        const encoder = this.device.createCommandEncoder();
        const texture = this.context.getCurrentTexture();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: texture.createView(),
                    clearValue: {
                        r: BACKGROUND_COLOR.red,
                        g: BACKGROUND_COLOR.green,
                        b: BACKGROUND_COLOR.blue,
                        a: BACKGROUND_COLOR.alpha,
                    },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        // --- Terrain pass ---
        renderPass.setPipeline(this.terrainPipeline.pipeline);
        renderPass.setBindGroup(0, this.terrainBindGroup);

        // Each chunk owns its group 1 bind group (offset baked in at init, never re-written).
        const chunks = this.world.getChunks();
        for (const chunk of chunks) {
            chunk.draw(renderPass);
        }

        // --- Overlay pass (red highlight) ---
        if (this.hasHit) {
            renderPass.setPipeline(this.overlayPipeline.pipeline);
            renderPass.setBindGroup(0, this.overlayBindGroup);
            renderPass.setVertexBuffer(0, this.highlightVBO);
            renderPass.draw(3);
        }

        // --- Crosshair pass ---
        renderPass.setPipeline(this.crosshairPipeline.pipeline);
        renderPass.setBindGroup(0, this.crosshairBindGroup);
        renderPass.setVertexBuffer(0, this.crosshairVBO);
        renderPass.draw(6);  // 2 triangles = 6 vertices

        renderPass.end();
        this.device.queue.submit([encoder.finish()]);
    }

    /**
     * Apply a sculpt operation at the last ray-triangle hit point.
     */
    sculpt(delta: number): void {
        if (!this.hasHit) return;
        this.world.sculptAt(
            this.lastHit.x,
            this.lastHit.y,
            this.lastHit.z,
            SCULPT_RADIUS,
            delta
        );
    }

    /**
     * Returns pre-generation progress so the caller (module.ts) can drive
     * the loading bar without needing a direct reference to the World.
     */
    getLoadingProgress(): { done: number; total: number; isComplete: boolean } {
        return this.world.getPregenerationProgress();
    }

    /**
     * Check AABB collision with the terrain (used for camera collision).
     */
    collidesWithAABB(
        minX: number,
        minY: number,
        minZ: number,
        maxX: number,
        maxY: number,
        maxZ: number
    ): boolean {
        return this.world.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /**
     * Returns the outward unit normal of the first overlapping terrain triangle,
     * or null if no triangle overlaps. Used by the camera controller for slope detection.
     */
    collidesWithAABBNormal(
        minX: number,
        minY: number,
        minZ: number,
        maxX: number,
        maxY: number,
        maxZ: number
    ): Vertex3 | null {
        return this.world.collidesWithAABBNormal(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /**
     * Clean up GPU resources.
     */
    destroy(): void {
        this.world.destroy();
        this.terrainUniformsBuffer0.destroy();
        this.terrainUniformsBuffer1.destroy();
        this.overlayUniformsBuffer0.destroy();
        this.overlayUniformsBuffer1.destroy();
        this.highlightVBO.destroy();
        this.crosshairVBO.destroy();
        this.depthTexture.destroy();
    }
}
