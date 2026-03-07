#include "renderer/RendererFactory.h"
#ifdef _WIN32
#  include "directx/DXRenderer.hpp"
#else
#  include "metal/MetalRenderer.hpp"
#endif

std::unique_ptr<IRenderer> RendererFactory::create(RendererBackend backend)
{
#ifdef _WIN32
    if (backend == RendererBackend::DirectX11)
        return std::make_unique<DXRenderer>();
#else
    if (backend == RendererBackend::Metal)
        return std::make_unique<MetalRenderer>();
#endif
    return nullptr;
}
