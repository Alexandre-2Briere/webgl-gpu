import { vi } from 'vitest';

export interface MockGPUBuffer {
  size: number
  usage: number
  destroy: ReturnType<typeof vi.fn>
}

export interface MockGPUDevice {
  createBuffer: ReturnType<typeof vi.fn>
  queue: { writeBuffer: ReturnType<typeof vi.fn> }
  limits: { minUniformBufferOffsetAlignment: number }
}

/**
 * Returns a minimal fake GPUDevice for unit tests.
 * Each call to createBuffer records the descriptor and returns a MockGPUBuffer.
 */
export function makeMockDevice(alignment = 256): MockGPUDevice {
  const writeBuffer = vi.fn();

  const createBuffer = vi.fn((descriptor: { size: number; usage: number }) => {
    const buf: MockGPUBuffer = {
      size: descriptor.size,
      usage: descriptor.usage,
      destroy: vi.fn(),
    };
    return buf;
  });

  return {
    createBuffer,
    queue: { writeBuffer },
    limits: { minUniformBufferOffsetAlignment: alignment },
  };
}
