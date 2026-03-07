#import <Metal/Metal.h>
#include "MetalPipeline.hpp"

struct MetalPipeline::Impl {
    id<MTLRenderPipelineState> pso;
    id<MTLDepthStencilState>   depthState;
};

MetalPipeline::MetalPipeline(void* device, void* vertFn, void* fragFn,
                              uint32_t colorFmt, uint32_t depthFmt,
                              bool depthTest, bool noVertexDescriptor)
    : m_impl(std::make_unique<Impl>())
{
    id<MTLDevice>   dev  = (__bridge id<MTLDevice>)device;
    id<MTLFunction> vert = (__bridge id<MTLFunction>)vertFn;
    id<MTLFunction> frag = (__bridge id<MTLFunction>)fragFn;

    // --- Render pipeline ---
    MTLRenderPipelineDescriptor* pd = [[MTLRenderPipelineDescriptor alloc] init];
    pd.vertexFunction                  = vert;
    pd.fragmentFunction                = frag;
    pd.colorAttachments[0].pixelFormat = (MTLPixelFormat)colorFmt;
    pd.depthAttachmentPixelFormat      = (MTLPixelFormat)depthFmt;

    if (!noVertexDescriptor) {
        // Vertex descriptor matches struct Vertex: float3 position, float3 normal.
        MTLVertexDescriptor* vd = [MTLVertexDescriptor vertexDescriptor];
        vd.attributes[0].format      = MTLVertexFormatFloat3;
        vd.attributes[0].offset      = 0;
        vd.attributes[0].bufferIndex = 0;
        vd.attributes[1].format      = MTLVertexFormatFloat3;
        vd.attributes[1].offset      = 12;
        vd.attributes[1].bufferIndex = 0;
        vd.layouts[0].stride         = 24;
        vd.layouts[0].stepFunction   = MTLVertexStepFunctionPerVertex;
        pd.vertexDescriptor = vd;
    }

    NSError* err = nil;
    m_impl->pso = [dev newRenderPipelineStateWithDescriptor:pd error:&err];
    if (!m_impl->pso)
        NSLog(@"[MetalPipeline] PSO error: %@", err.localizedDescription);

    // --- Depth stencil state ---
    MTLDepthStencilDescriptor* dd = [[MTLDepthStencilDescriptor alloc] init];
    dd.depthCompareFunction = depthTest ? MTLCompareFunctionLess : MTLCompareFunctionAlways;
    dd.depthWriteEnabled    = depthTest ? YES : NO;
    m_impl->depthState = [dev newDepthStencilStateWithDescriptor:dd];
}

MetalPipeline::~MetalPipeline() = default;

void* MetalPipeline::nativePipelineState() const noexcept
{
    return (__bridge void*)m_impl->pso;
}

void* MetalPipeline::nativeDepthState() const noexcept
{
    return (__bridge void*)m_impl->depthState;
}
