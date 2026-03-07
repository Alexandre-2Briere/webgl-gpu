#pragma once
// No windows.h / d3d11.h here — all D3D types hidden behind the PIMPL.
#include <memory>
#include "renderer/IShader.h"

class DXShader : public IShader {
public:
    /// @param profile  HLSL target profile, e.g. "vs_5_0" or "ps_5_0".
    DXShader(void* device, const char* source, const char* entryPoint, const char* profile);
    ~DXShader() override;

    void* nativeShader()    const noexcept;  // ID3D11VertexShader* or ID3D11PixelShader*
    void* nativeBytecode()  const noexcept;  // ID3DBlob* — needed for input layout creation
    bool  isVertexShader()  const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
