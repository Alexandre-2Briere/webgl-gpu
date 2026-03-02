// src/modules/marchingCubes/shaders/crosshairVertShader.ts

// WHY: WebGPU has no gl.POINTS / gl_PointSize / gl_PointCoord. We replace the
// point sprite with a small hardcoded quad (4 vertices, 2 triangles) in NDC space.
// The quad is ~0.04 units (in NDC [-1,1]), which at typical viewport is ~15px.
// Each vertex carries its normalized local position [0,1]² so the fragment shader
// can carve the cross shape.

export const CROSSHAIR_VERT_SOURCE = /* wgsl */`
struct VertexInput {
    @location(0) position: vec2f,   // NDC quad vertex [-0.04 to 0.04]
    @location(1) localCoord: vec2f, // [0, 1]² — for drawing the cross in frag shader
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) localCoord: vec2f,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    // Position is already in NDC (clip space), just promote to vec4f
    output.clipPosition = vec4f(input.position, 0.0, 1.0);
    output.localCoord = input.localCoord;
    return output;
}
`;
