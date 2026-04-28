import { vi } from 'vitest';
import { makeMockDevice, type MockGPUDevice, type MockGPUBuffer } from '../buffers/mockDevice';
import type { RenderableInitArgs } from '../../gameObject/3D/renderables/Renderable';
import type { PipelineCache } from '../../core/PipelineCache';
import type { BindGroupLayouts } from '../../types';
import type { UniformPool } from '../../buffers/UniformPool';

export interface MockUniformSlot {
  buffer: MockGPUBuffer
  offset: number
  size: number
}

export interface MockUniformPool {
  allocate: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  free: ReturnType<typeof vi.fn>
}

export interface MockPipelineCache {
  getOrCreateRender: ReturnType<typeof vi.fn>
}

export interface MockRenderableDevice extends MockGPUDevice {
  createBindGroup: ReturnType<typeof vi.fn>
  createShaderModule: ReturnType<typeof vi.fn>
  createPipelineLayout: ReturnType<typeof vi.fn>
}

export interface MockRenderableInitArgs {
  args: RenderableInitArgs
  device: MockRenderableDevice
  uniformPool: MockUniformPool
  uniformSlot: MockUniformSlot
  pipelineCache: MockPipelineCache
}

export function makeMockRenderableInitArgs(): MockRenderableInitArgs {
  const base = makeMockDevice();

  const device: MockRenderableDevice = {
    ...base,
    createBindGroup: vi.fn().mockReturnValue({}),
    createShaderModule: vi.fn().mockReturnValue({}),
    createPipelineLayout: vi.fn().mockReturnValue({}),
  };

  const mockBuffer: MockGPUBuffer = { size: 256, usage: 0x40, destroy: vi.fn() };
  const uniformSlot: MockUniformSlot = { buffer: mockBuffer, offset: 0, size: 256 };

  const uniformPool: MockUniformPool = {
    allocate: vi.fn().mockReturnValue(uniformSlot),
    write: vi.fn(),
    free: vi.fn(),
  };

  const pipelineCache: MockPipelineCache = {
    getOrCreateRender: vi.fn().mockReturnValue({}),
  };

  const args: RenderableInitArgs = {
    device: device as unknown as GPUDevice,
    queue: device.queue as unknown as GPUQueue,
    format: 'bgra8unorm' as GPUTextureFormat,
    pipelineCache: pipelineCache as unknown as PipelineCache,
    layouts: { camera: {}, object: {}, empty: {}, lights: {}, fbxMaterial: {}, gizmo: {}, groundExtra: {} } as unknown as BindGroupLayouts,
    uniformPool: uniformPool as unknown as UniformPool,
  };

  return { args, device, uniformPool, uniformSlot, pipelineCache };
}
