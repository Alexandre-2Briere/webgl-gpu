#pragma once
// No windows.h / d3d11.h here — all D3D types hidden behind the PIMPL.
#include <cstdint>
#include <memory>
#include "renderer/IRenderer.h"

class DXRenderer : public IRenderer {
public:
    DXRenderer();
    ~DXRenderer() override;

    bool init(void* windowHandle, uint32_t width, uint32_t height) override;
    void resize(uint32_t width, uint32_t height) override;

    std::unique_ptr<IBuffer>         createBuffer(BufferType type, size_t size) override;
    std::unique_ptr<IShader>         createShader(const char* source) override;
    std::unique_ptr<IRenderPipeline> createPipeline(const PipelineDesc& desc) override;

    ICommandBuffer* beginFrame() override;
    void            endFrame()   override;
    void            present()    override;

    /// DirectX-specific helpers (not on IRenderer).
    /// @param profile  e.g. "vs_5_0" or "ps_5_0"
    std::unique_ptr<IShader> createShaderWithName(const char* source,
                                                  const char* entryPoint,
                                                  const char* profile);
    void* nativeDevice()        const noexcept;  // ID3D11Device*
    void* nativeDeviceContext() const noexcept;  // ID3D11DeviceContext*

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
