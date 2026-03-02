// src/modules/marchingCubes/shaders/crosshairFragShader.ts
//
// WHY: The quad covers a ±0.1 NDC square. localCoord is [0,1]² so the
// centre is (0.5, 0.5). Recentring to [-0.5, 0.5] maps local radius 0.5
// directly to NDC radius 0.1. Fragments outside that radius are discarded,
// leaving a solid black circle (dot) at screen centre.

export const CROSSHAIR_FRAG_SOURCE = /* wgsl */`
struct FragmentInput {
    @location(0) localCoord: vec2f,  // [0, 1]² from vertex shader
};

struct FragmentOutput {
    @location(0) color: vec4f,
};

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
    // Recentre to [-0.5, 0.5]; local radius 0.5 == NDC radius 0.1.
    let uv = input.localCoord - vec2f(0.5);

    if length(uv) > 0.02 {
        discard;
    }

    var output: FragmentOutput;
    output.color = vec4f(0.0, 0.0, 0.0, 1.0);  // solid black dot
    return output;
}
`;
