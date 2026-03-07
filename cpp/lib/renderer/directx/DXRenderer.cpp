#include <d3d11.h>
#include <dxgi.h>
#include "DXRenderer.hpp"
#include "DXBuffer.hpp"
#include "DXShader.hpp"
#include "DXPipeline.hpp"
#include "renderer/ICommandBuffer.h"
#include "renderer/IBuffer.h"
#include "renderer/IRenderPipeline.h"

// ---------------------------------------------------------------------------
// Internal command buffer
// ---------------------------------------------------------------------------
class DXCommandBuffer : public ICommandBuffer {
public:
    ID3D11DeviceContext* ctx    = nullptr;
    uint32_t             stride = 0;

    void setPipeline(IRenderPipeline* pipeline) override
    {
        DXPipeline* dp = static_cast<DXPipeline*>(pipeline);
        stride = dp->stride();

        ID3D11InputLayout*       il = static_cast<ID3D11InputLayout*>(dp->nativeInputLayout());
        ID3D11VertexShader*      vs = static_cast<ID3D11VertexShader*>(dp->nativeVertexShader());
        ID3D11PixelShader*       ps = static_cast<ID3D11PixelShader*>(dp->nativePixelShader());
        ID3D11DepthStencilState* ds = static_cast<ID3D11DepthStencilState*>(dp->nativeDepthStencilState());

        ctx->IASetInputLayout(il);
        ctx->VSSetShader(vs, nullptr, 0);
        ctx->PSSetShader(ps, nullptr, 0);
        ctx->OMSetDepthStencilState(ds, 0);
    }

    void setVertexBuffer(IBuffer* buf, uint32_t slot) override
    {
        DXBuffer*       db = static_cast<DXBuffer*>(buf);
        ID3D11Buffer*   b  = static_cast<ID3D11Buffer*>(db->nativeBuffer());
        UINT            s  = stride;
        UINT            o  = 0;
        ctx->IASetVertexBuffers(slot, 1, &b, &s, &o);
    }

    void setUniformBuffer(IBuffer* buf, uint32_t slot) override
    {
        DXBuffer*     db = static_cast<DXBuffer*>(buf);
        ID3D11Buffer* b  = static_cast<ID3D11Buffer*>(db->nativeBuffer());
        ctx->VSSetConstantBuffers(slot, 1, &b);
    }

    void draw(uint32_t vertexCount) override
    {
        if (vertexCount == 0) return;
        ctx->Draw(vertexCount, 0);
    }

    void drawIndexed(IBuffer*, uint32_t) override {}
};

// ---------------------------------------------------------------------------
// PIMPL
// ---------------------------------------------------------------------------
struct DXRenderer::Impl {
    ID3D11Device*           device          = nullptr;
    ID3D11DeviceContext*    context         = nullptr;
    IDXGISwapChain*         swapChain       = nullptr;
    ID3D11RenderTargetView* rtv             = nullptr;
    ID3D11Texture2D*        depthTex        = nullptr;
    ID3D11DepthStencilView* dsv             = nullptr;
    DXCommandBuffer         cmdBuffer;
    uint32_t                width           = 0;
    uint32_t                height          = 0;
};

static bool createDepthBuffer(DXRenderer::Impl* p)
{
    if (p->dsv)      { p->dsv->Release();      p->dsv      = nullptr; }
    if (p->depthTex) { p->depthTex->Release(); p->depthTex = nullptr; }

    D3D11_TEXTURE2D_DESC td = {};
    td.Width            = p->width;
    td.Height           = p->height;
    td.MipLevels        = 1;
    td.ArraySize        = 1;
    td.Format           = DXGI_FORMAT_D32_FLOAT;
    td.SampleDesc.Count = 1;
    td.Usage            = D3D11_USAGE_DEFAULT;
    td.BindFlags        = D3D11_BIND_DEPTH_STENCIL;

    if (FAILED(p->device->CreateTexture2D(&td, nullptr, &p->depthTex))) return false;

    D3D11_DEPTH_STENCIL_VIEW_DESC dsvd = {};
    dsvd.Format        = DXGI_FORMAT_D32_FLOAT;
    dsvd.ViewDimension = D3D11_DSV_DIMENSION_TEXTURE2D;

    return SUCCEEDED(p->device->CreateDepthStencilView(p->depthTex, &dsvd, &p->dsv));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
DXRenderer::DXRenderer()  : m_impl(std::make_unique<Impl>()) {}
DXRenderer::~DXRenderer()
{
    if (m_impl->dsv)      m_impl->dsv->Release();
    if (m_impl->depthTex) m_impl->depthTex->Release();
    if (m_impl->rtv)      m_impl->rtv->Release();
    if (m_impl->swapChain) m_impl->swapChain->Release();
    if (m_impl->context)  m_impl->context->Release();
    if (m_impl->device)   m_impl->device->Release();
}

bool DXRenderer::init(void* windowHandle, uint32_t width, uint32_t height)
{
    HWND hwnd = static_cast<HWND>(windowHandle);
    m_impl->width  = width;
    m_impl->height = height;

    DXGI_SWAP_CHAIN_DESC scd               = {};
    scd.BufferCount                        = 2;
    scd.BufferDesc.Width                   = width;
    scd.BufferDesc.Height                  = height;
    scd.BufferDesc.Format                  = DXGI_FORMAT_R8G8B8A8_UNORM;
    scd.BufferDesc.RefreshRate.Numerator   = 60;
    scd.BufferDesc.RefreshRate.Denominator = 1;
    scd.BufferUsage                        = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    scd.OutputWindow                       = hwnd;
    scd.SampleDesc.Count                   = 1;
    scd.Windowed                           = TRUE;
    scd.SwapEffect                         = DXGI_SWAP_EFFECT_DISCARD;

    D3D_FEATURE_LEVEL level;
    HRESULT hr = D3D11CreateDeviceAndSwapChain(
        nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0,
        nullptr, 0, D3D11_SDK_VERSION,
        &scd, &m_impl->swapChain,
        &m_impl->device, &level, &m_impl->context);

    if (FAILED(hr)) return false;

    // Back-buffer RTV
    ID3D11Texture2D* backBuf = nullptr;
    m_impl->swapChain->GetBuffer(0, __uuidof(ID3D11Texture2D),
                                  reinterpret_cast<void**>(&backBuf));
    m_impl->device->CreateRenderTargetView(backBuf, nullptr, &m_impl->rtv);
    backBuf->Release();

    if (!createDepthBuffer(m_impl.get())) return false;

    // Viewport
    D3D11_VIEWPORT vp = {};
    vp.Width    = static_cast<float>(width);
    vp.Height   = static_cast<float>(height);
    vp.MaxDepth = 1.0f;
    m_impl->context->RSSetViewports(1, &vp);

    // Primitive topology — set once, never changes
    m_impl->context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    m_impl->cmdBuffer.ctx = m_impl->context;
    return true;
}

void DXRenderer::resize(uint32_t width, uint32_t height)
{
    m_impl->width  = width;
    m_impl->height = height;

    // Release views before resizing the swap chain
    m_impl->context->OMSetRenderTargets(0, nullptr, nullptr);
    if (m_impl->rtv) { m_impl->rtv->Release(); m_impl->rtv = nullptr; }

    m_impl->swapChain->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0);

    ID3D11Texture2D* backBuf = nullptr;
    m_impl->swapChain->GetBuffer(0, __uuidof(ID3D11Texture2D),
                                  reinterpret_cast<void**>(&backBuf));
    m_impl->device->CreateRenderTargetView(backBuf, nullptr, &m_impl->rtv);
    backBuf->Release();

    createDepthBuffer(m_impl.get());

    D3D11_VIEWPORT vp = {};
    vp.Width    = static_cast<float>(width);
    vp.Height   = static_cast<float>(height);
    vp.MaxDepth = 1.0f;
    m_impl->context->RSSetViewports(1, &vp);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
ICommandBuffer* DXRenderer::beginFrame()
{
    float clear[4] = { 0.0f, 0.0f, 0.0f, 1.0f };
    m_impl->context->ClearRenderTargetView(m_impl->rtv, clear);
    m_impl->context->ClearDepthStencilView(m_impl->dsv, D3D11_CLEAR_DEPTH, 1.0f, 0);
    m_impl->context->OMSetRenderTargets(1, &m_impl->rtv, m_impl->dsv);
    return &m_impl->cmdBuffer;
}

void DXRenderer::endFrame()  {}  // no-op: D3D11 immediate context executes immediately

void DXRenderer::present()
{
    m_impl->swapChain->Present(1, 0);
}

// ---------------------------------------------------------------------------
// Resource factory
// ---------------------------------------------------------------------------
std::unique_ptr<IBuffer> DXRenderer::createBuffer(BufferType type, size_t size)
{
    return std::make_unique<DXBuffer>(m_impl->device, m_impl->context, type, size);
}

std::unique_ptr<IShader> DXRenderer::createShader(const char*)
{
    return nullptr;  // use createShaderWithName()
}

std::unique_ptr<IShader> DXRenderer::createShaderWithName(
    const char* source, const char* entryPoint, const char* profile)
{
    return std::make_unique<DXShader>(m_impl->device, source, entryPoint, profile);
}

std::unique_ptr<IRenderPipeline> DXRenderer::createPipeline(const PipelineDesc& desc)
{
    DXShader* vert = static_cast<DXShader*>(desc.vertex);
    DXShader* frag = static_cast<DXShader*>(desc.fragment);
    return std::make_unique<DXPipeline>(
        m_impl->device, vert, frag,
        desc.depthTest, desc.noVertexDescriptor);
}

void* DXRenderer::nativeDevice()        const noexcept { return m_impl->device; }
void* DXRenderer::nativeDeviceContext() const noexcept { return m_impl->context; }
