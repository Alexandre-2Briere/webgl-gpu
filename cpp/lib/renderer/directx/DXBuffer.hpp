#pragma once
// No windows.h / d3d11.h here — all D3D types hidden behind the PIMPL.
#include <cstddef>
#include <memory>
#include "renderer/IBuffer.h"

class DXBuffer : public IBuffer {
public:
    DXBuffer(void* device, void* deviceContext, BufferType type, size_t size);
    ~DXBuffer() override;

    void   upload(const void* data, size_t bytes) override;
    size_t size() const override;

    void*      nativeBuffer()  const noexcept;  // ID3D11Buffer*
    BufferType bufferType()    const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
