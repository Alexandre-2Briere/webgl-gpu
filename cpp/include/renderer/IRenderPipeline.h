#pragma once

class IShader;

/// Describes the full pipeline state to be compiled.
struct PipelineDesc {
    IShader* vertex            = nullptr;
    IShader* fragment          = nullptr;
    bool     depthTest         = true;   ///< false disables depth test + write (HUD, crosshair)
    bool     noVertexDescriptor = false; ///< true when vertex positions come from vertex_id
};

/// Compiled, immutable pipeline state object (MTLRenderPipelineState / D3D12 PSO / …).
class IRenderPipeline {
public:
    virtual ~IRenderPipeline() = default;
};
