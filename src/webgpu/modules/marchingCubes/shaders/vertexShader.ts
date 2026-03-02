// WHY: Terrain vertex shader computes world position and passes it to the fragment
// shader for per-pixel flat-normal lighting. The chunk offset is applied here
// before the model-view-projection transforms.

// WHY: Two separate bind groups let the renderer update per-frame data (matrices)
// once without touching the per-chunk data (offset). Critically, per-chunk uniforms
// are written ONCE at chunk init and never change, eliminating the async writeBuffer
// race condition that caused all chunks to share the last written offset.
//   group 0: frame-level data — updated once per frame by the renderer
//   group 1: chunk-level data — written once at chunk creation, immutable after that

export const VERTEX_SOURCE = /* wgsl */`
struct FrameUniforms {
    modelMatrix: mat4x4f,
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
};

struct ChunkUniforms {
    // vec3f must be padded to vec4f alignment (16 bytes) in uniform buffers
    chunkOffset: vec3f,
};

struct VertexInput {
    @location(0) position: vec3f,  // Object-space vertex position, metres
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) worldPosition: vec3f,  // World-space position for fragment shader
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> chunk: ChunkUniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    let offsetPosition = input.position + chunk.chunkOffset;
    let worldPosition = frame.modelMatrix * vec4f(offsetPosition, 1.0);

    var output: VertexOutput;
    output.worldPosition = worldPosition.xyz;
    output.clipPosition = frame.projectionMatrix * frame.viewMatrix * worldPosition;

    return output;
}
`;