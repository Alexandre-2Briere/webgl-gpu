#include <d3d11.h>
#include "DXBuffer.hpp"
#include <cstring>

struct DXBuffer::Impl {
    ID3D11Buffer*        buffer;
    ID3D11DeviceContext* ctx;
    size_t               sz;
    BufferType           type;
};

DXBuffer::DXBuffer(void* device, void* deviceContext, BufferType type, size_t size)
    : m_impl(std::make_unique<Impl>())
{
    ID3D11Device*        dev = static_cast<ID3D11Device*>(device);
    ID3D11DeviceContext* ctx = static_cast<ID3D11DeviceContext*>(deviceContext);

    m_impl->ctx  = ctx;
    m_impl->sz   = size;
    m_impl->type = type;

    UINT bindFlag = D3D11_BIND_VERTEX_BUFFER;
    if (type == BufferType::Index)   bindFlag = D3D11_BIND_INDEX_BUFFER;
    if (type == BufferType::Uniform) bindFlag = D3D11_BIND_CONSTANT_BUFFER;

    D3D11_BUFFER_DESC bd = {};
    bd.ByteWidth      = static_cast<UINT>(size);
    bd.Usage          = D3D11_USAGE_DYNAMIC;
    bd.BindFlags      = bindFlag;
    bd.CPUAccessFlags = D3D11_CPU_ACCESS_WRITE;

    dev->CreateBuffer(&bd, nullptr, &m_impl->buffer);
}

DXBuffer::~DXBuffer()
{
    if (m_impl->buffer) m_impl->buffer->Release();
}

void DXBuffer::upload(const void* data, size_t bytes)
{
    if (!m_impl->buffer) return;
    D3D11_MAPPED_SUBRESOURCE ms = {};
    if (SUCCEEDED(m_impl->ctx->Map(m_impl->buffer, 0, D3D11_MAP_WRITE_DISCARD, 0, &ms))) {
        size_t copy = bytes < m_impl->sz ? bytes : m_impl->sz;
        std::memcpy(ms.pData, data, copy);
        m_impl->ctx->Unmap(m_impl->buffer, 0);
    }
}

size_t     DXBuffer::size()       const { return m_impl->sz; }
void*      DXBuffer::nativeBuffer() const noexcept { return m_impl->buffer; }
BufferType DXBuffer::bufferType()   const noexcept { return m_impl->type; }
