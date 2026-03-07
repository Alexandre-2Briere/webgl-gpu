#pragma once

// ---------------------------------------------------------------------------
// HLSL terrain shader — simple diffuse + ambient shading.
// #pragma pack_matrix(column_major) ensures the same matrix memory layout as MSL.
// Vertex struct (float3 position, float3 normal) matches DXPipeline's input layout
// (stride 24, POSITION at offset 0, NORMAL at offset 12).
// ---------------------------------------------------------------------------
static const char* kHLSLSource = R"(
#pragma pack_matrix(column_major)

cbuffer Uniforms : register(b1) {
    float4x4 mvp;
};

struct VertIn {
    float3 position : POSITION;
    float3 normal   : NORMAL;
};

struct VertOut {
    float4 position : SV_Position;
    float3 normal   : TEXCOORD0;
};

VertOut VSMain(VertIn input)
{
    VertOut o;
    o.position = mul(mvp, float4(input.position, 1.0));
    o.normal   = input.normal;
    return o;
}

float4 PSMain(VertOut input) : SV_Target
{
    float3 lightDir = normalize(float3(0.6, 1.0, 0.4));
    float  diffuse  = max(dot(normalize(input.normal), lightDir), 0.0);
    float3 color    = float3(0.35, 0.55, 0.25) * (diffuse * 0.8 + 0.2);
    return float4(color, 1.0);
}
)";

// ---------------------------------------------------------------------------
// HLSL crosshair — 6 vertices generated from SV_VertexID, no vertex buffer.
// The fragment shader discards pixels outside the inscribed circle → round dot.
// ---------------------------------------------------------------------------
static const char* kCrosshairHLSL = R"(
static const float4 kVerts[6] = {
    float4(-0.01, -0.01, 0.0, 0.0),
    float4( 0.01, -0.01, 1.0, 0.0),
    float4(-0.01,  0.01, 0.0, 1.0),
    float4(-0.01,  0.01, 0.0, 1.0),
    float4( 0.01, -0.01, 1.0, 0.0),
    float4( 0.01,  0.01, 1.0, 1.0),
};

struct CrosshairOut {
    float4 position : SV_Position;
    float2 uv       : TEXCOORD0;
};

CrosshairOut CrosshairVSMain(uint vid : SV_VertexID)
{
    CrosshairOut o;
    o.position = float4(kVerts[vid].xy, 0.0, 1.0);
    o.uv       = kVerts[vid].zw;
    return o;
}

float4 CrosshairPSMain(CrosshairOut input) : SV_Target
{
    float2 uv = input.uv * 2.0 - 1.0;
    if (length(uv) > 1.0) discard;
    return float4(0.0, 0.0, 0.0, 1.0);
}
)";
