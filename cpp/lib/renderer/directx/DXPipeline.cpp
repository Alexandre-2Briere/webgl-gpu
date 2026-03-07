#include <d3d11.h>
#include "DXPipeline.hpp"
#include "DXShader.hpp"

struct DXPipeline::Impl {
    ID3D11InputLayout*      inputLayout  = nullptr;
    ID3D11VertexShader*     vertShader   = nullptr;
    ID3D11PixelShader*      pixShader    = nullptr;
    ID3D11DepthStencilState* depthState  = nullptr;
    uint32_t                stride       = 0;
};

DXPipeline::DXPipeline(void* device, DXShader* vert, DXShader* frag,
                        bool depthTest, bool noVertexDescriptor)
    : m_impl(std::make_unique<Impl>())
{
    ID3D11Device* dev = static_cast<ID3D11Device*>(device);

    // Retain references — the pipeline owns these for its lifetime.
    // Caller (DXRenderer) guarantees shaders outlive pipelines through
    // unique_ptr ownership in WorldRenderer.
    m_impl->vertShader = static_cast<ID3D11VertexShader*>(vert->nativeShader());
    m_impl->pixShader  = static_cast<ID3D11PixelShader*>(frag->nativeShader());
    if (m_impl->vertShader) m_impl->vertShader->AddRef();
    if (m_impl->pixShader)  m_impl->pixShader->AddRef();

    // --- Input layout (Vertex: float3 position, float3 normal — stride 24) ---
    if (!noVertexDescriptor) {
        D3D11_INPUT_ELEMENT_DESC elems[2] = {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0,  0, D3D11_INPUT_PER_VERTEX_DATA, 0 },
            { "NORMAL",   0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D11_INPUT_PER_VERTEX_DATA, 0 },
        };
        ID3DBlob* bc = static_cast<ID3DBlob*>(vert->nativeBytecode());
        if (bc) {
            dev->CreateInputLayout(elems, 2,
                bc->GetBufferPointer(), bc->GetBufferSize(),
                &m_impl->inputLayout);
        }
        m_impl->stride = 24;
    }

    // --- Depth stencil state ---
    D3D11_DEPTH_STENCIL_DESC dd = {};
    dd.DepthEnable    = depthTest ? TRUE : FALSE;
    dd.DepthWriteMask = depthTest ? D3D11_DEPTH_WRITE_MASK_ALL : D3D11_DEPTH_WRITE_MASK_ZERO;
    dd.DepthFunc      = depthTest ? D3D11_COMPARISON_LESS : D3D11_COMPARISON_ALWAYS;
    dev->CreateDepthStencilState(&dd, &m_impl->depthState);
}

DXPipeline::~DXPipeline()
{
    if (m_impl->inputLayout) m_impl->inputLayout->Release();
    if (m_impl->vertShader)  m_impl->vertShader->Release();
    if (m_impl->pixShader)   m_impl->pixShader->Release();
    if (m_impl->depthState)  m_impl->depthState->Release();
}

void*    DXPipeline::nativeInputLayout()       const noexcept { return m_impl->inputLayout; }
void*    DXPipeline::nativeVertexShader()      const noexcept { return m_impl->vertShader; }
void*    DXPipeline::nativePixelShader()       const noexcept { return m_impl->pixShader; }
void*    DXPipeline::nativeDepthStencilState() const noexcept { return m_impl->depthState; }
uint32_t DXPipeline::stride()                  const noexcept { return m_impl->stride; }
