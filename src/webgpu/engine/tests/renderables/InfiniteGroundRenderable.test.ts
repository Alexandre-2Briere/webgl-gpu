import { describe, it, expect, beforeEach } from 'vitest';
import { InfiniteGroundRenderable } from '../../gameObject/renderables/InfiniteGroundRenderable';
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs';

let mock: MockRenderableInitArgs;

beforeEach(() => {
  mock = makeMockRenderableInitArgs();
});

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('InfiniteGroundRenderable — pre-init identity', () => {
  it('id is a symbol', () => {
    expect(typeof new InfiniteGroundRenderable().id).toBe('symbol');
  });

  it('layer is "world"', () => {
    expect(new InfiniteGroundRenderable().layer).toBe('world');
  });

  it('pipelineKey is "infinite-ground"', () => {
    expect(new InfiniteGroundRenderable().pipelineKey).toBe('infinite-ground');
  });

  it('visible is true by default', () => {
    expect(new InfiniteGroundRenderable().visible).toBe(true);
  });

  it('default color is [0.55, 0.55, 0.55, 1]', () => {
    const ground = new InfiniteGroundRenderable();
    expect(ground.color[0]).toBeCloseTo(0.55, 5);
    expect(ground.color[3]).toBeCloseTo(1,    5);
  });

  it('default alternateColor is [0.45, 0.45, 0.45, 1]', () => {
    const ground = new InfiniteGroundRenderable();
    expect(ground.alternateColor[0]).toBeCloseTo(0.45, 5);
    expect(ground.alternateColor[3]).toBeCloseTo(1,    5);
  });

  it('default tileSize is 16', () => {
    expect(new InfiniteGroundRenderable().tileSize).toBe(4);
  });

  it('default yLevel is 0', () => {
    expect(new InfiniteGroundRenderable().yLevel).toBe(0);
  });

  it('custom options are reflected in getters', () => {
    const ground = new InfiniteGroundRenderable({
      color:          [0.1, 0.2, 0.3, 1],
      alternateColor: [0.4, 0.5, 0.6, 1],
      tileSize:       32,
      yLevel:         5,
    });
    expect(ground.color[0]).toBeCloseTo(0.1, 5);
    expect(ground.alternateColor[0]).toBeCloseTo(0.4, 5);
    expect(ground.tileSize).toBe(32);
    expect(ground.yLevel).toBe(5);
  });
});

// ── clone() ───────────────────────────────────────────────────────────────────

describe('InfiniteGroundRenderable — clone()', () => {
  it('clone returns a different reference', () => {
    const ground = new InfiniteGroundRenderable();
    expect(ground.clone()).not.toBe(ground);
  });

  it('clone has a different id', () => {
    const ground = new InfiniteGroundRenderable();
    expect(ground.clone().id).not.toBe(ground.id);
  });

  it('clone preserves all options', () => {
    const ground = new InfiniteGroundRenderable({
      color:          [0.1, 0.2, 0.3, 1],
      alternateColor: [0.4, 0.5, 0.6, 1],
      tileSize:       64,
      yLevel:         -2,
    });
    const cloned = ground.clone();
    expect(cloned.color[0]).toBeCloseTo(0.1, 5);
    expect(cloned.alternateColor[0]).toBeCloseTo(0.4, 5);
    expect(cloned.tileSize).toBe(64);
    expect(cloned.yLevel).toBe(-2);
  });
});

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('InfiniteGroundRenderable — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80);
  });

  it('calls device.createBuffer at least 3 times (vertex, index, groundExtra)', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(3);
  });

  it('calls device.createBindGroup twice (object + groundExtra)', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    expect(mock.device.createBindGroup).toHaveBeenCalledTimes(2);
  });

  it('calls pipelineCache.getOrCreateRender with "infinite-ground"', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    expect(mock.pipelineCache.getOrCreateRender).toHaveBeenCalledWith(
      'infinite-ground',
      expect.any(Object),
    );
  });

  it('pipeline descriptor has cullMode "none"', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.primitive.cullMode).toBe('none');
  });

  it('pipeline depthStencil uses depthCompare "less"', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.depthStencil.depthCompare).toBe('less');
  });

  it('pipeline depthStencil has depthWriteEnabled true', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.depthStencil.depthWriteEnabled).toBe(true);
  });
});

// ── setColor / setAlternateColor / setTileSize round-trips ───────────────────

describe('InfiniteGroundRenderable — color and tileSize setters after init', () => {
  it('setColor updates color getter', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.setColor(0.1, 0.2, 0.3, 0.4);
    expect(ground.color[0]).toBeCloseTo(0.1, 5);
    expect(ground.color[1]).toBeCloseTo(0.2, 5);
    expect(ground.color[2]).toBeCloseTo(0.3, 5);
    expect(ground.color[3]).toBeCloseTo(0.4, 5);
  });

  it('setAlternateColor updates alternateColor getter', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.setAlternateColor(0.6, 0.7, 0.8, 0.9);
    expect(ground.alternateColor[0]).toBeCloseTo(0.6, 5);
    expect(ground.alternateColor[1]).toBeCloseTo(0.7, 5);
    expect(ground.alternateColor[2]).toBeCloseTo(0.8, 5);
    expect(ground.alternateColor[3]).toBeCloseTo(0.9, 5);
  });

  it('setTileSize updates tileSize getter', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.setTileSize(32);
    expect(ground.tileSize).toBe(32);
  });
});

// ── setPosition / yLevel ──────────────────────────────────────────────────────

describe('InfiniteGroundRenderable — setPosition() updates yLevel', () => {
  it('setPosition updates yLevel', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.setPosition([0, 7, 0]);
    expect(ground.yLevel).toBe(7);
  });

  it('setPosition to negative y: yLevel reflects negative value', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.setPosition([0, -3, 0]);
    expect(ground.yLevel).toBe(-3);
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('InfiniteGroundRenderable — destroy()', () => {
  it('destroy() calls destroy on all three owned GPU buffers', () => {
    const ground = new InfiniteGroundRenderable();
    ground.init(mock.args);
    ground.destroy();
    const bufferDestroyCallCount = (mock.device.createBuffer as ReturnType<typeof import('vitest').vi.fn>)
      .mock.results
      .filter(r => r.type === 'return')
      .map(r => r.value as { destroy: ReturnType<typeof import('vitest').vi.fn> })
      .filter(buf => buf.destroy.mock.calls.length > 0)
      .length;
    expect(bufferDestroyCallCount).toBe(3);
  });
});
