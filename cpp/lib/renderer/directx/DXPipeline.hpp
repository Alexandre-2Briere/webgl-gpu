#pragma once
// No windows.h / d3d11.h here — all D3D types hidden behind the PIMPL.
#include <cstdint>
#include <memory>
#include "renderer/IRenderPipeline.h"

class DXShader;

class DXPipeline : public IRenderPipeline {
public:
    DXPipeline(void*      device,
               DXShader*  vert,
               DXShader*  frag,
               bool       depthTest,
               bool       noVertexDescriptor);
    ~DXPipeline() override;

    void*    nativeInputLayout()       const noexcept;  // ID3D11InputLayout*
    void*    nativeVertexShader()      const noexcept;  // ID3D11VertexShader*
    void*    nativePixelShader()       const noexcept;  // ID3D11PixelShader*
    void*    nativeDepthStencilState() const noexcept;  // ID3D11DepthStencilState*
    uint32_t stride()                  const noexcept;  // vertex stride in bytes (0 if no VB)

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
