import { VERTEX_SOURCE } from './vertexShader';
import { FRAGMENT_SOURCE } from './fragmentShader';
import { OVERLAY_VERT_SOURCE } from './overlayVertShader';
import { OVERLAY_FRAG_SOURCE } from './overlayFragShader';
import { CROSSHAIR_VERT_SOURCE } from './crosshairVertShader';
import { CROSSHAIR_FRAG_SOURCE } from './crosshairFragShader';

// WHY: TerrainPipelineBundle extends PipelineBundle with the chunk bind group layout.
// This is needed so each Chunk can create its own GPUBindGroup for group 1 (chunk offset).
export interface PipelineBundle {
    pipeline: GPURenderPipeline;
    bindGroupLayout: GPUBindGroupLayout;
}

export interface TerrainPipelineBundle extends PipelineBundle {
    // Layout for group 1 — one bind group is created per chunk at init time.
    chunkBindGroupLayout: GPUBindGroupLayout;
}

function createShaderModule(device: GPUDevice, code: string): GPUShaderModule {
    return device.createShaderModule({ code });
}

/**
 * Create the terrain render pipeline (main marching cubes mesh).
 *
 * Group 0 (frame-level, shared per frame):
 *   binding 0: FrameUniforms { modelMatrix, viewMatrix, projectionMatrix }
 *   binding 1: LightUniforms { lightDirection }
 *
 * Group 1 (chunk-level, per-chunk bind group created once at chunk init):
 *   binding 0: ChunkUniforms { chunkOffset: vec3f }
 *
 * WHY two groups: group 0 is updated once per frame; group 1 is written once at
 * chunk creation and never changed. Separating them removes the async writeBuffer
 * race condition that caused all chunks to render at the same position.
 */
export function createTerrainPipeline(
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
): TerrainPipelineBundle {
    const vertexModule = createShaderModule(device, VERTEX_SOURCE);
    const fragmentModule = createShaderModule(device, FRAGMENT_SOURCE);

    // Group 0: frame-level uniforms (matrices + light direction)
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
            },
        ],
    });

    // Group 1: chunk-level uniforms (chunk offset only)
    const chunkBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' },
            },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout, chunkBindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: vertexModule,
            entryPoint: 'main',
            buffers: [
                {
                    arrayStride: 3 * 4, // 3 floats * 4 bytes
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                },
            ],
        },
        fragment: {
            module: fragmentModule,
            entryPoint: 'main',
            targets: [{ format: swapChainFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'cw',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less',
        },
    });

    return { pipeline, bindGroupLayout, chunkBindGroupLayout };
}

/**
 * Create the overlay render pipeline (red highlight triangle).
 * Bind group 0 binding 0: overlay uniforms (view + projection matrices)
 * Bind group 0 binding 1: overlay color (RGBA)
 */
export function createOverlayPipeline(
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
): PipelineBundle {
    const vertexModule = createShaderModule(device, OVERLAY_VERT_SOURCE);
    const fragmentModule = createShaderModule(device, OVERLAY_FRAG_SOURCE);

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
            },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: vertexModule,
            entryPoint: 'main',
            buffers: [
                {
                    arrayStride: 3 * 4, // 3 floats * 4 bytes (world-space positions)
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
                },
            ],
        },
        fragment: {
            module: fragmentModule,
            entryPoint: 'main',
            targets: [{ format: swapChainFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'cw',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: false,
            depthCompare: 'less-equal',
            // WHY: The overlay vertices are mathematically identical to the terrain
            // triangle but transformed via a different matrix path (world-space vs
            // model+chunk-offset), so floating-point rounding produces micro-differences
            // that cause z-fighting even with 'less-equal'. A negative depth bias nudges
            // all overlay fragments toward the camera so they reliably pass the test.
            depthBias: -2,
            depthBiasSlopeScale: -1.0,
            depthBiasClamp: 0,
        },
    });

    return { pipeline, bindGroupLayout };
}

/**
 * Create the crosshair render pipeline (white cross at screen center).
 * No uniforms; position and shape are hardcoded in the shader.
 * The crosshair is drawn as a small quad (4 vertices, 2 triangles) in NDC space.
 */
export function createCrosshairPipeline(
    device: GPUDevice,
    swapChainFormat: GPUTextureFormat
): PipelineBundle {
    const vertexModule = createShaderModule(device, CROSSHAIR_VERT_SOURCE);
    const fragmentModule = createShaderModule(device, CROSSHAIR_FRAG_SOURCE);

    // Crosshair doesn't use uniforms, so bind group layout is empty.
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: vertexModule,
            entryPoint: 'main',
            buffers: [
                {
                    // Quad vertices: [position (vec2), localCoord (vec2)]
                    arrayStride: 4 * 4, // 4 floats * 4 bytes
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' },       // position
                        { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' },   // localCoord
                    ],
                },
            ],
        },
        fragment: {
            module: fragmentModule,
            entryPoint: 'main',
            targets: [{ format: swapChainFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'ccw',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: false,  // Crosshair is always on top
            depthCompare: 'always',    // No depth comparison; always pass
        },
    });

    return { pipeline, bindGroupLayout };
}
