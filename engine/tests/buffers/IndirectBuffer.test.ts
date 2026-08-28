import { describe, it, expect, beforeEach } from 'vitest';
import { IndirectBuffer } from '../../buffers/IndirectBuffer';
import { makeMockDevice, type MockGPUDevice, type MockGPUBuffer } from './mockDevice';

// GPUBufferUsage constants are not available in Node — define the values used by IndirectBuffer
const INDIRECT = 0x0100;
const STORAGE  = 0x0080;
const COPY_DST = 0x0008;

describe('IndirectBuffer', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = makeMockDevice();
  });

  it('creates a GPU buffer with INDIRECT | STORAGE | COPY_DST usage flags', () => {
    new IndirectBuffer(device as unknown as GPUDevice);

    const [descriptor] = device.createBuffer.mock.calls[0];
    expect(descriptor.usage & INDIRECT).toBeTruthy();
    expect(descriptor.usage & STORAGE).toBeTruthy();
    expect(descriptor.usage & COPY_DST).toBeTruthy();
  });

  it('allocates exactly 16 bytes — enough for the four u32 drawIndirect fields', () => {
    new IndirectBuffer(device as unknown as GPUDevice);

    const [descriptor] = device.createBuffer.mock.calls[0];
    expect(descriptor.size).toBe(16);
  });

  it('writes the initial state [0, 1, 0, 0] immediately on construction', () => {
    new IndirectBuffer(device as unknown as GPUDevice);

    expect(device.queue.writeBuffer).toHaveBeenCalledOnce();
    const [, offset, data] = device.queue.writeBuffer.mock.calls[0];
    expect(offset).toBe(0);
    const written = new Uint32Array(data.buffer ?? data);
    // vertexCount=0, instanceCount=1, firstVertex=0, firstInstance=0
    expect(Array.from(written)).toEqual([0, 1, 0, 0]);
  });

  it('reset() writes only [0] at offset 0 — zeroing vertexCount only', () => {
    const ib = new IndirectBuffer(device as unknown as GPUDevice);
    device.queue.writeBuffer.mockClear();

    ib.reset();

    expect(device.queue.writeBuffer).toHaveBeenCalledOnce();
    const [, offset, data] = device.queue.writeBuffer.mock.calls[0];
    expect(offset).toBe(0);
    const written = new Uint32Array(data.buffer ?? data);
    // Only the first word (vertexCount) is overwritten; instanceCount stays 1 in the buffer
    expect(written[0]).toBe(0);
    expect(written.length).toBe(1);
  });

  it('exposes the underlying GPUBuffer via the buffer getter', () => {
    const ib = new IndirectBuffer(device as unknown as GPUDevice);
    expect(ib.buffer).toBeDefined();
  });

  it('delegates destroy() to the underlying GPUBuffer', () => {
    const ib = new IndirectBuffer(device as unknown as GPUDevice);
    const gpuBuf = ib.buffer as unknown as MockGPUBuffer;
    ib.destroy();
    expect(gpuBuf.destroy).toHaveBeenCalledOnce();
  });
});
