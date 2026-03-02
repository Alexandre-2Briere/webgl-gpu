// src/modules/marchingCubes/shaders/overlayFragShader.ts

// WHY: Overlay fragment shader is trivially simple — just outputs the uniform color.
// Used for the red hover triangle, kept in its own program for clarity.

export const OVERLAY_FRAG_SOURCE = /* wgsl */`
struct Uniforms {
    color: vec4f,  // RGBA, linear colour space
};

struct FragmentOutput {
    @location(0) color: vec4f,
};

@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@fragment
fn main() -> FragmentOutput {
    var output: FragmentOutput;
    output.color = uniforms.color;
    return output;
}
`;
