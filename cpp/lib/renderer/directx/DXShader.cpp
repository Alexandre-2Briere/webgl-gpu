#include <d3d11.h>
#include <d3dcompiler.h>
#include "DXShader.hpp"
#include <cstring>

struct DXShader::Impl {
    ID3DBlob*            bytecode   = nullptr;
    ID3D11VertexShader*  vertShader = nullptr;
    ID3D11PixelShader*   pixShader  = nullptr;
    bool                 isVS       = false;
};

DXShader::DXShader(void* device, const char* source, const char* entryPoint, const char* profile)
    : m_impl(std::make_unique<Impl>())
{
    ID3D11Device* dev = static_cast<ID3D11Device*>(device);

    ID3DBlob* errBlob = nullptr;
    HRESULT hr = D3DCompile(
        source, std::strlen(source),
        nullptr, nullptr, nullptr,
        entryPoint, profile,
        D3DCOMPILE_ENABLE_STRICTNESS, 0,
        &m_impl->bytecode, &errBlob);

    if (FAILED(hr)) {
        if (errBlob) {
            OutputDebugStringA(static_cast<const char*>(errBlob->GetBufferPointer()));
            errBlob->Release();
        }
        return;  // m_impl->vertShader / pixShader stay nullptr
    }
    if (errBlob) errBlob->Release();

    m_impl->isVS = (std::strncmp(profile, "vs", 2) == 0);

    if (m_impl->isVS) {
        dev->CreateVertexShader(
            m_impl->bytecode->GetBufferPointer(),
            m_impl->bytecode->GetBufferSize(),
            nullptr, &m_impl->vertShader);
    } else {
        dev->CreatePixelShader(
            m_impl->bytecode->GetBufferPointer(),
            m_impl->bytecode->GetBufferSize(),
            nullptr, &m_impl->pixShader);
    }
}

DXShader::~DXShader()
{
    if (m_impl->bytecode)   m_impl->bytecode->Release();
    if (m_impl->vertShader) m_impl->vertShader->Release();
    if (m_impl->pixShader)  m_impl->pixShader->Release();
}

void* DXShader::nativeShader() const noexcept
{
    return m_impl->isVS
        ? static_cast<void*>(m_impl->vertShader)
        : static_cast<void*>(m_impl->pixShader);
}

void* DXShader::nativeBytecode() const noexcept { return m_impl->bytecode; }
bool  DXShader::isVertexShader() const noexcept { return m_impl->isVS; }
