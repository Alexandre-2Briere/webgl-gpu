import { describe, it, expect, beforeEach } from 'vitest';
import { ArrowGizmo } from '../../gameObject/renderables/ArrowGizmo';
import { ARROW_GIZMO_VISIBLE_KEY, ARROW_GIZMO_OCCLUDED_KEY } from '../../shaders/arrowGizmo';
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs';
import type { MockGPUBuffer } from '../buffers/mockDevice';

let mock: MockRenderableInitArgs;

beforeEach(() => {
  mock = makeMockRenderableInitArgs();
});

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('ArrowGizmo — pre-init identity', () => {
  it('id is a symbol', () => {
    const gizmo = new ArrowGizmo();
    expect(typeof gizmo.id).toBe('symbol');
  });

  it('layer is "world-overlay"', () => {
    const gizmo = new ArrowGizmo();
    expect(gizmo.layer).toBe('world-overlay');
  });

  it('pipelineKey is the visible pipeline key', () => {
    const gizmo = new ArrowGizmo();
    expect(gizmo.pipelineKey).toBe(ARROW_GIZMO_VISIBLE_KEY);
  });

  it('visible is false by default', () => {
    const gizmo = new ArrowGizmo();
    expect(gizmo.visible).toBe(false);
  });

  it('color getter returns default X-axis color', () => {
    const gizmo = new ArrowGizmo();
    expect(gizmo.color[0]).toBeCloseTo(1,    4);
    expect(gizmo.color[1]).toBeCloseTo(0.15, 4);
    expect(gizmo.color[2]).toBeCloseTo(0.15, 4);
    expect(gizmo.color[3]).toBeCloseTo(1,    4);
  });

  it('color getter reflects custom colorX option', () => {
    const gizmo = new ArrowGizmo({ colorX: [0.5, 0.6, 0.7, 0.8] });
    expect(gizmo.color[0]).toBeCloseTo(0.5, 4);
    expect(gizmo.color[1]).toBeCloseTo(0.6, 4);
    expect(gizmo.color[2]).toBeCloseTo(0.7, 4);
    expect(gizmo.color[3]).toBeCloseTo(0.8, 4);
  });
});

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('ArrowGizmo — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80);
  });

  it('calls uniformPool.write once', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(mock.uniformPool.write).toHaveBeenCalledOnce();
  });

  it('calls device.createBuffer once (standalone gizmo buffer, 64 bytes)', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(1);
    const callArg = mock.device.createBuffer.mock.calls[0][0];
    expect(callArg.size).toBe(64);
  });

  it('calls device.createBindGroup twice (object + gizmo)', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(mock.device.createBindGroup).toHaveBeenCalledTimes(2);
  });

  it('calls device.createShaderModule once', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(mock.device.createShaderModule).toHaveBeenCalledOnce();
  });

  it('calls pipelineCache.getOrCreateRender with the visible key', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    const getOrCreate = mock.pipelineCache.getOrCreateRender;
    expect(getOrCreate).toHaveBeenCalledWith(ARROW_GIZMO_VISIBLE_KEY, expect.anything());
  });

  it('calls pipelineCache.getOrCreateRender with the occluded key', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    const getOrCreate = mock.pipelineCache.getOrCreateRender;
    expect(getOrCreate).toHaveBeenCalledWith(ARROW_GIZMO_OCCLUDED_KEY, expect.anything());
  });

  it('calls pipelineCache.getOrCreateRender exactly twice', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    const getOrCreate = mock.pipelineCache.getOrCreateRender;
    expect(getOrCreate).toHaveBeenCalledTimes(2);
  });

  it('does not throw with default options', () => {
    const gizmo = new ArrowGizmo();
    expect(() => gizmo.init(mock.args)).not.toThrow();
  });

  it('does not throw with custom axis colors', () => {
    const gizmo = new ArrowGizmo({
      colorX: [1, 0, 0, 1],
      colorY: [0, 1, 0, 1],
      colorZ: [0, 0, 1, 1],
    });
    expect(() => gizmo.init(mock.args)).not.toThrow();
  });

  it('second call to init() does not re-allocate from uniformPool', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    gizmo.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledTimes(1);
  });
});

// ── setPosition() ──────────────────────────────────────────────────────────────

describe('ArrowGizmo — setPosition()', () => {
  it('triggers queue.writeBuffer', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setPosition([1, 2, 3]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });

  it('position getter reflects new values after setPosition', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    gizmo.setPosition([4, 5, 6]);
    expect(gizmo.position).toEqual([4, 5, 6]);
  });
});

// ── setQuaternion() ────────────────────────────────────────────────────────────

describe('ArrowGizmo — setQuaternion()', () => {
  it('triggers queue.writeBuffer', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setQuaternion([0, 0, 0, 1]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setScale() ─────────────────────────────────────────────────────────────────

describe('ArrowGizmo — setScale()', () => {
  it('triggers queue.writeBuffer', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setScale(2, 2, 2);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setAxisVisible() ───────────────────────────────────────────────────────────

describe('ArrowGizmo — setAxisVisible()', () => {
  it('hiding X axis clears bit 0 in the visibility mask', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setAxisVisible(0, false);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
    // Verify the mask written to the gizmo buffer: bit 0 should be 0, bits 1+2 remain set
    const writtenData = mock.device.queue.writeBuffer.mock.calls[0][2] as Float32Array;
    const maskU32 = new Uint32Array(writtenData.buffer, writtenData.byteOffset)[12];
    expect(maskU32 & 1).toBe(0);   // X hidden
    expect(maskU32 & 2).toBe(2);   // Y still visible
    expect(maskU32 & 4).toBe(4);   // Z still visible
  });

  it('hiding Y axis clears bit 1 in the visibility mask', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setAxisVisible(1, false);
    const writtenData = mock.device.queue.writeBuffer.mock.calls[0][2] as Float32Array;
    const maskU32 = new Uint32Array(writtenData.buffer, writtenData.byteOffset)[12];
    expect(maskU32 & 2).toBe(0);
  });

  it('hiding Z axis clears bit 2 in the visibility mask', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setAxisVisible(2, false);
    const writtenData = mock.device.queue.writeBuffer.mock.calls[0][2] as Float32Array;
    const maskU32 = new Uint32Array(writtenData.buffer, writtenData.byteOffset)[12];
    expect(maskU32 & 4).toBe(0);
  });

  it('re-showing a hidden axis restores the bit', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    gizmo.setAxisVisible(0, false);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setAxisVisible(0, true);
    const writtenData = mock.device.queue.writeBuffer.mock.calls[0][2] as Float32Array;
    const maskU32 = new Uint32Array(writtenData.buffer, writtenData.byteOffset)[12];
    expect(maskU32 & 1).toBe(1);
  });

  it('triggers queue.writeBuffer on each call', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    gizmo.setAxisVisible(0, false);
    gizmo.setAxisVisible(1, false);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalledTimes(2);
  });
});

// ── visible flag ───────────────────────────────────────────────────────────────

describe('ArrowGizmo — visible flag', () => {
  it('can be toggled to true without throwing', () => {
    const gizmo = new ArrowGizmo();
    expect(() => { gizmo.visible = true; }).not.toThrow();
    expect(gizmo.visible).toBe(true);
  });

  it('can be toggled back to false without throwing', () => {
    const gizmo = new ArrowGizmo();
    gizmo.visible = true;
    expect(() => { gizmo.visible = false; }).not.toThrow();
    expect(gizmo.visible).toBe(false);
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('ArrowGizmo — destroy()', () => {
  it('calls destroy() on the standalone gizmo buffer', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    const gizmoGPUBuffer = mock.device.createBuffer.mock.results[0].value as MockGPUBuffer;
    gizmo.destroy();
    expect(gizmoGPUBuffer.destroy).toHaveBeenCalledOnce();
  });

  it('does not throw', () => {
    const gizmo = new ArrowGizmo();
    gizmo.init(mock.args);
    expect(() => gizmo.destroy()).not.toThrow();
  });
});

// ── clone() ────────────────────────────────────────────────────────────────────

describe('ArrowGizmo — clone()', () => {
  it('does not throw', () => {
    const gizmo = new ArrowGizmo();
    expect(() => gizmo.clone()).not.toThrow();
  });

  it('returns an ArrowGizmo instance', () => {
    const gizmo = new ArrowGizmo();
    expect(gizmo.clone()).toBeInstanceOf(ArrowGizmo);
  });
});
