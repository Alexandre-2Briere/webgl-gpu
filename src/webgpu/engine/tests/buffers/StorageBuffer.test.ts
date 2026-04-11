import { describe, it, expect, beforeEach } from 'vitest';
import { StorageBuffer } from '../../buffers/StorageBuffer';
import { makeMockDevice, type MockGPUDevice, type MockGPUBuffer } from './mockDevice';

// GPUBufferUsage constants are not available in Node — define the values used by StorageBuffer
const STORAGE   = 0x0080;
const COPY_DST  = 0x0008;
const MAP_READ  = 0x0001;

describe('StorageBuffer', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = makeMockDevice();
  });

  it('creates a GPU buffer with STORAGE | COPY_DST usage flags', () => {
    new StorageBuffer(device as unknown as GPUDevice, 1024);

    const [descriptor] = device.createBuffer.mock.calls[0];
    expect(descriptor.usage & STORAGE).toBeTruthy();
    expect(descriptor.usage & COPY_DST).toBeTruthy();
  });

  it('does not set the MAP_READ flag — the buffer cannot be read back to CPU', () => {
    new StorageBuffer(device as unknown as GPUDevice, 1024);

    const [descriptor] = device.createBuffer.mock.calls[0];
    expect(descriptor.usage & MAP_READ).toBe(0);
  });

  it('exposes the byte size passed at construction via the size getter', () => {
    const sb = new StorageBuffer(device as unknown as GPUDevice, 2048);
    expect(sb.size).toBe(2048);
  });

  it('exposes the underlying GPUBuffer via the buffer getter', () => {
    const sb = new StorageBuffer(device as unknown as GPUDevice, 64);
    expect(sb.buffer).toBeDefined();
  });

  it('forwards write() to queue.writeBuffer without throwing', () => {
    const sb = new StorageBuffer(device as unknown as GPUDevice, 256);
    const data = new Float32Array([1.0, 2.0, 3.0]);
    expect(() => sb.write(data)).not.toThrow();
    expect(device.queue.writeBuffer).toHaveBeenCalledOnce();
  });

  it('passes the offsetBytes argument through to queue.writeBuffer', () => {
    const sb = new StorageBuffer(device as unknown as GPUDevice, 512);
    const data = new Uint32Array([42]);
    sb.write(data, 128);
    const [, offset] = device.queue.writeBuffer.mock.calls[0];
    expect(offset).toBe(128);
  });

  it('delegates destroy() to the underlying GPUBuffer', () => {
    const sb = new StorageBuffer(device as unknown as GPUDevice, 128);
    const gpuBuf = sb.buffer as unknown as MockGPUBuffer;
    sb.destroy();
    expect(gpuBuf.destroy).toHaveBeenCalledOnce();
  });
});
