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

  it('slots within the same chunk reference the same GPUBuffer', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 3);
    const a = pool.allocate(ALIGNMENT);
    const b = pool.allocate(ALIGNMENT);
    expect(a.buffer).toBe(b.buffer);
  });

  // ── Capacity boundary ─────────────────────────────────────────────────────

  it('does not throw when the last allocation exactly fills the chunk', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 2);
    expect(() => {
      pool.allocate(ALIGNMENT);
      pool.allocate(ALIGNMENT);
    }).not.toThrow();
  });

  // ── Auto-growth ───────────────────────────────────────────────────────────

  it('allocates beyond initial capacity without throwing', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    pool.allocate(ALIGNMENT); // fills initial chunk

    expect(() => pool.allocate(ALIGNMENT)).not.toThrow();
  });

  it('slots from different chunks reference different GPUBuffers', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    const first  = pool.allocate(ALIGNMENT); // fills initial chunk
    const second = pool.allocate(ALIGNMENT); // triggers new chunk
    expect(first.buffer).not.toBe(second.buffer);
  });

  // ── Freelist ──────────────────────────────────────────────────────────────

  it('free() + allocate() reuses the freed slot', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT * 2);
    const slot = pool.allocate(ALIGNMENT);
    const { buffer, offset, size } = slot;

    pool.free(slot);
    const reused = pool.allocate(ALIGNMENT);

    expect(reused.buffer).toBe(buffer);
    expect(reused.offset).toBe(offset);
    expect(reused.size).toBe(size);
  });

  it('freelist is checked before growing', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    const slot = pool.allocate(ALIGNMENT); // fills the only chunk

    pool.free(slot);
    // Should reuse the freed slot rather than creating a new chunk
    const createCountBefore = (device.createBuffer as ReturnType<typeof import('vitest').vi.fn>).mock.calls.length;
    pool.allocate(ALIGNMENT);
    const createCountAfter = (device.createBuffer as ReturnType<typeof import('vitest').vi.fn>).mock.calls.length;

    expect(createCountAfter).toBe(createCountBefore); // no new buffer created
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

  it('destroy() destroys all allocated chunk buffers', () => {
    const pool = new UniformPool(device as unknown as GPUDevice, ALIGNMENT);
    const firstSlot  = pool.allocate(ALIGNMENT); // chunk 0
    const secondSlot = pool.allocate(ALIGNMENT); // chunk 1 (auto-grew)

    const chunk0 = firstSlot.buffer as unknown as MockGPUBuffer;
    const chunk1 = secondSlot.buffer as unknown as MockGPUBuffer;

    pool.destroy();

    expect(chunk0.destroy).toHaveBeenCalledOnce();
    expect(chunk1.destroy).toHaveBeenCalledOnce();
  });
});
