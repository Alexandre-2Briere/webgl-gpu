import { describe, it, expect, beforeEach } from 'vitest';
import { VertexBuffer } from '../../buffers/VertexBuffer';
import { makeMockDevice, type MockGPUDevice, type MockGPUBuffer } from './mockDevice';

// GPUBufferUsage constants are not available in Node — define the values used by VertexBuffer
const VERTEX   = 0x0020;
const COPY_DST = 0x0008;

describe('VertexBuffer', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = makeMockDevice();
  });

  it('creates a GPU buffer with VERTEX | COPY_DST usage flags', () => {
    new VertexBuffer(device as unknown as GPUDevice, 1024);

    const [descriptor] = device.createBuffer.mock.calls[0];
    expect(descriptor.usage & VERTEX).toBeTruthy();
    expect(descriptor.usage & COPY_DST).toBeTruthy();
  });

  it('exposes the byte size passed at construction via the size getter', () => {
    const vb = new VertexBuffer(device as unknown as GPUDevice, 512);
    expect(vb.size).toBe(512);
  });

  it('exposes the underlying GPUBuffer via the buffer getter', () => {
    const vb = new VertexBuffer(device as unknown as GPUDevice, 64);
    expect(vb.buffer).toBeDefined();
  });

  it('forwards write() to queue.writeBuffer with the correct data', () => {
    const vb = new VertexBuffer(device as unknown as GPUDevice, 256);
    const data = new Float32Array([1, 2, 3, 4]);
    vb.write(data);
    expect(device.queue.writeBuffer).toHaveBeenCalledOnce();
    const [buf, offset, arrayBuffer] = device.queue.writeBuffer.mock.calls[0];
    expect(buf).toBe(vb.buffer);
    expect(offset).toBe(0);
    expect(arrayBuffer).toBe(data.buffer);
  });

  it('passes the offsetBytes argument through to queue.writeBuffer', () => {
    const vb = new VertexBuffer(device as unknown as GPUDevice, 256);
    const data = new Float32Array([7, 8]);
    vb.write(data, 64);
    const [, offset] = device.queue.writeBuffer.mock.calls[0];
    expect(offset).toBe(64);
  });

  it('delegates destroy() to the underlying GPUBuffer', () => {
    const vb = new VertexBuffer(device as unknown as GPUDevice, 128);
    const gpuBuf = vb.buffer as unknown as MockGPUBuffer;
    vb.destroy();
    expect(gpuBuf.destroy).toHaveBeenCalledOnce();
  });
});
