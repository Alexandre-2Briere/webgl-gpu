// WHY: Terrain fragment shader computes per-pixel flat normals using screen-space
// derivatives (dpdx/dpdy), then applies diffuse + 0.4 ambient lighting.
// Flat normals are cheap and work well for voxel-like terrain.
// Height-based colour blending gives natural grass / dirt / stone layering.

export const FRAGMENT_SOURCE = /* wgsl */`
struct Uniforms {
    lightDirection: vec3f,
    // WHY: surfaceY reuses the mandatory vec3f padding bytes so no extra buffer
    // is needed. The shader uses it to derive height-based colour thresholds.
    surfaceY: f32,
};

struct FragmentInput {
    @location(0) worldPosition: vec3f,  // World-space position from vertex shader
};

struct FragmentOutput {
    @location(0) color: vec4f,
};

@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
    // Compute flat normal from screen-space derivatives of world position.
    // WHY: dpdx/dpdy are screen-space derivatives; computing normals from them
    // gives per-pixel flat shading without explicit normal attributes.
    // WHY swapped: WebGPU framebuffer origin is top-left (Y down), so dpdy has the
    // opposite sign vs WebGL (bottom-left, Y up). Swapping the cross operands corrects
    // the winding and produces outward-facing normals.
    let normal = normalize(cross(dpdy(input.worldPosition), dpdx(input.worldPosition)));

    let diffuse = max(dot(normal, normalize(uniforms.lightDirection)), 0.0);
    let ambient = 0.4;
    let light   = ambient + diffuse;

    // Height-based colour zones (relative to the terrain surface level surfaceY):
    //   grass : y > surfaceY - 2   top 2 units below the surface
    //   dirt  : y > surfaceY - 10  next 8 units below that
    //   stone : y <= surfaceY - 10 deep underground
    let grassColor = vec3f(0.28, 0.58, 0.18);
    let dirtColor  = vec3f(0.55, 0.35, 0.15);
    let stoneColor = vec3f(0.50, 0.48, 0.44);

    let y         = input.worldPosition.y;
    let grassLine = uniforms.surfaceY - 2.0;
    let stoneLine = uniforms.surfaceY - 10.0;

    // WHY select(): branchless colour pick avoids dynamic branching in the shader.
    let baseColor = select(
        select(stoneColor, dirtColor, y > stoneLine),
        grassColor,
        y > grassLine
    );

    var output: FragmentOutput;
    output.color = vec4f(baseColor * light, 1.0);
    return output;
}
`;
