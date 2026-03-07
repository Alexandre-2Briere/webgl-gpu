#pragma once

// ---------------------------------------------------------------------------
// MSL terrain shader — simple diffuse + ambient shading.
// Vertex struct layout (float3 position, float3 normal) must match
// MetalPipeline's vertex descriptor (stride 24, attributes 0 and 1).
// ---------------------------------------------------------------------------
static const char* kMSLSource = R"(
#include <metal_stdlib>
using namespace metal;

struct VertIn {
    float3 position [[attribute(0)]];
    float3 normal   [[attribute(1)]];
};

struct VertOut {
    float4 position [[position]];
    float3 normal;
};

struct Uniforms {
    float4x4 mvp;
};

vertex VertOut vertexMain(VertIn in [[stage_in]],
                          constant Uniforms& u [[buffer(1)]])
{
    VertOut out;
    out.position = u.mvp * float4(in.position, 1.0);
    out.normal   = in.normal;
    return out;
}

fragment float4 fragmentMain(VertOut in [[stage_in]])
{
    float3 lightDir = normalize(float3(0.6, 1.0, 0.4));
    float  diffuse  = max(dot(normalize(in.normal), lightDir), 0.0);
    float3 color    = float3(0.35, 0.55, 0.25) * (diffuse * 0.8 + 0.2);
    return float4(color, 1.0);
}
)";

// ---------------------------------------------------------------------------
// MSL crosshair — 6 vertices (2 triangles) generated from vertex_id.
// No vertex buffer required. The quad spans ±0.01 NDC; the fragment shader
// discards pixels outside the inscribed circle, giving a solid black dot.
// ---------------------------------------------------------------------------
static const char* kCrosshairMSL = R"(
#include <metal_stdlib>
using namespace metal;

struct CrosshairOut {
    float4 position [[position]];
    float2 uv;
};

// Two triangles forming a ±0.01 NDC quad at screen centre.
// Must be at file scope: MSL does not allow constant-address-space local variables.
constant float4 kCrosshairData[6] = {
    float4(-0.01f, -0.01f, 0.0f, 0.0f),
    float4( 0.01f, -0.01f, 1.0f, 0.0f),
    float4(-0.01f,  0.01f, 0.0f, 1.0f),
    float4(-0.01f,  0.01f, 0.0f, 1.0f),
    float4( 0.01f, -0.01f, 1.0f, 0.0f),
    float4( 0.01f,  0.01f, 1.0f, 1.0f),
};

vertex CrosshairOut crosshairVert(uint vid [[vertex_id]])
{
    CrosshairOut out;
    out.position = float4(kCrosshairData[vid].xy, 0.0f, 1.0f);
    out.uv       = kCrosshairData[vid].zw;
    return out;
}

fragment float4 crosshairFrag(CrosshairOut in [[stage_in]])
{
    // Remap [0,1]^2 UV to [-1,1]^2; discard outside unit circle → round dot.
    float2 uv = in.uv * 2.0f - 1.0f;
    if (length(uv) > 1.0f) discard_fragment();
    return float4(0.0f, 0.0f, 0.0f, 1.0f);
}
)";
