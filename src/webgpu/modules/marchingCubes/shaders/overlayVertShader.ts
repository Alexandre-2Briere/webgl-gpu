// src/modules/marchingCubes/shaders/overlayVertShader.ts

// WHY: Overlay vertex shader transforms the hovered triangle from world space
// to clip space. The triangle is pre-computed in world coords by a raycast, so
// no chunk offset is needed here.

export const OVERLAY_VERT_SOURCE = /* wgsl */`
struct Uniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
};

struct VertexInput {
    @location(0) position: vec3f,  // World-space vertex position
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = uniforms.projectionMatrix * uniforms.viewMatrix * vec4f(input.position, 1.0);
    return output;
}
`;
