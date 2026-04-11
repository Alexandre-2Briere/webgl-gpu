import { describe, it, expect, beforeEach } from 'vitest';
import { UniformPool } from '../../buffers/UniformPool';
import { makeMockDevice, type MockGPUDevice, type MockGPUBuffer } from './mockDevice';

const ALIGNMENT = 256;

describe('UniformPool', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = makeMockDevice(ALIGNMENT);
  });

  // ── Allocation alignment ──────────────────────────────────────────────────

  it('returns slots whose offsets are always a multiple of minUniformBufferOffsetAlignment', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 10);

    // Request sizes that are NOT already multiples of 256
    for (const size of [1, 17, 100, 200, 255]) {
      const slot = pool.allocate(size);
      expect(slot.offset % ALIGNMENT).toBe(0);
    }
  });

  it('rounds the slot size up to the alignment boundary', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 4);
    const slot = pool.allocate(1);   // 1 byte → rounded up to 256
    expect(slot.size).toBe(ALIGNMENT);
  });

  // ── Sequential, non-overlapping allocation ────────────────────────────────

  it('allocates non-overlapping sequential slots', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 5);
    const slots = [
      pool.allocate(ALIGNMENT),
      pool.allocate(ALIGNMENT),
      pool.allocate(ALIGNMENT),
    ];

    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].offset).toBeGreaterThanOrEqual(slots[i - 1].offset + slots[i - 1].size);
    }
  });

  it('all slots reference the same underlying GPUBuffer', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 3);
    const a = pool.allocate(ALIGNMENT);
    const b = pool.allocate(ALIGNMENT);
    expect(a.buffer).toBe(b.buffer);
  });

  // ── Capacity boundary ─────────────────────────────────────────────────────

  it('does not throw when the last allocation exactly fills the pool', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 2);
    expect(() => {
      pool.allocate(ALIGNMENT);
      pool.allocate(ALIGNMENT);
    }).not.toThrow();
  });

  it('throws when an allocation would exceed pool capacity', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    pool.allocate(ALIGNMENT); // fills the pool exactly

    expect(() => pool.allocate(1)).toThrow();
  });

  it('throws even for a 1-byte request after the pool is exhausted', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 3);
    pool.allocate(ALIGNMENT);
    pool.allocate(ALIGNMENT);
    pool.allocate(ALIGNMENT); // pool full

    expect(() => pool.allocate(1)).toThrow();
  });

  // ── write() ───────────────────────────────────────────────────────────────

  it('write() calls queue.writeBuffer at the slot offset', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 2);
    const slot = pool.allocate(ALIGNMENT);

    const data = new Float32Array(4);
    pool.write(slot, data);

    expect(device.queue.writeBuffer).toHaveBeenCalledOnce();
    const [, writtenOffset] = device.queue.writeBuffer.mock.calls[0];
    expect(writtenOffset).toBe(slot.offset);
  });

  // ── destroy() ─────────────────────────────────────────────────────────────

  it('delegates destroy() to the underlying GPUBuffer', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    const gpuBuf = pool.buffer as unknown as MockGPUBuffer;
    pool.destroy();
    expect(gpuBuf.destroy).toHaveBeenCalledOnce();
  });
});
