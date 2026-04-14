import { describe, it, expect, beforeEach } from 'vitest';
import { SkyboxRenderable } from '../../gameObject/renderables/SkyboxRenderable';
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs';

let mock: MockRenderableInitArgs;

beforeEach(() => {
  mock = makeMockRenderableInitArgs();
});

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('SkyboxRenderable — pre-init identity', () => {
  it('id is a symbol', () => {
    expect(typeof new SkyboxRenderable().id).toBe('symbol');
  });

  it('layer is "world"', () => {
    expect(new SkyboxRenderable().layer).toBe('world');
  });

  it('pipelineKey is "skybox"', () => {
    expect(new SkyboxRenderable().pipelineKey).toBe('skybox');
  });

  it('visible is true by default', () => {
    expect(new SkyboxRenderable().visible).toBe(true);
  });

  it('default color is [0.1, 0.12, 0.15, 1]', () => {
    const skybox = new SkyboxRenderable();
    expect(skybox.color[0]).toBeCloseTo(0.1,  5);
    expect(skybox.color[1]).toBeCloseTo(0.12, 5);
    expect(skybox.color[2]).toBeCloseTo(0.15, 5);
    expect(skybox.color[3]).toBeCloseTo(1,    5);
  });

  it('custom constructor color is reflected in getter', () => {
    const skybox = new SkyboxRenderable([0.3, 0.4, 0.5, 0.8]);
    expect(skybox.color[0]).toBeCloseTo(0.3, 5);
    expect(skybox.color[1]).toBeCloseTo(0.4, 5);
    expect(skybox.color[2]).toBeCloseTo(0.5, 5);
    expect(skybox.color[3]).toBeCloseTo(0.8, 5);
  });
});

// ── clone() ───────────────────────────────────────────────────────────────────

describe('SkyboxRenderable — clone()', () => {
  it('clone returns a different reference', () => {
    const skybox = new SkyboxRenderable();
    expect(skybox.clone()).not.toBe(skybox);
  });

  it('clone has a different id', () => {
    const skybox = new SkyboxRenderable();
    expect(skybox.clone().id).not.toBe(skybox.id);
  });

  it('clone preserves color', () => {
    const skybox = new SkyboxRenderable([0.2, 0.3, 0.4, 0.9]);
    const cloned = skybox.clone();
    expect(cloned.color[0]).toBeCloseTo(0.2, 5);
    expect(cloned.color[1]).toBeCloseTo(0.3, 5);
    expect(cloned.color[2]).toBeCloseTo(0.4, 5);
    expect(cloned.color[3]).toBeCloseTo(0.9, 5);
  });

  it('mutating clone color does not affect original', () => {
    const skybox = new SkyboxRenderable([0.1, 0.1, 0.1, 1]);
    const cloned = skybox.clone();
    // setColor requires init; test via pre-init _uniformData indirectly through color getter
    // We verify clone is independent — different Float32Array backing
    expect(cloned).not.toBe(skybox);
    expect(cloned.color).not.toBe(skybox.color);
  });
});

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('SkyboxRenderable — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80);
  });

  it('calls uniformPool.write after allocate', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    expect(mock.uniformPool.write).toHaveBeenCalled();
  });

  it('calls device.createBindGroup once (object bind group)', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    expect(mock.device.createBindGroup).toHaveBeenCalledTimes(1);
  });

  it('calls pipelineCache.getOrCreateRender with "skybox"', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    expect(mock.pipelineCache.getOrCreateRender).toHaveBeenCalledWith(
      'skybox',
      expect.any(Object),
    );
  });

  it('pipeline descriptor has no vertex buffers (procedural draw)', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.vertex.buffers).toHaveLength(0);
  });

  it('pipeline depthStencil uses depthCompare "always"', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.depthStencil.depthCompare).toBe('always');
  });

  it('pipeline depthStencil has depthWriteEnabled false', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    const [, descriptor] = mock.pipelineCache.getOrCreateRender.mock.calls[0];
    expect(descriptor.depthStencil.depthWriteEnabled).toBe(false);
  });
});

// ── setColor round-trip ───────────────────────────────────────────────────────

describe('SkyboxRenderable — setColor() after init', () => {
  it('setColor updates the color getter', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    skybox.setColor(0.7, 0.8, 0.9, 0.5);
    expect(skybox.color[0]).toBeCloseTo(0.7, 5);
    expect(skybox.color[1]).toBeCloseTo(0.8, 5);
    expect(skybox.color[2]).toBeCloseTo(0.9, 5);
    expect(skybox.color[3]).toBeCloseTo(0.5, 5);
  });

  it('setColor calls queue.writeBuffer', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    skybox.setColor(1, 0, 0, 1);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('SkyboxRenderable — destroy()', () => {
  it('destroy() does not throw', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    expect(() => skybox.destroy()).not.toThrow();
  });

  it('destroy() does not call device.createBuffer.destroy (no owned GPU buffers)', () => {
    const skybox = new SkyboxRenderable();
    skybox.init(mock.args);
    skybox.destroy();
    // The mock buffer is the uniformPool slot, owned by the pool — skybox should not destroy it
    expect(mock.uniformSlot.buffer.destroy).not.toHaveBeenCalled();
  });
});
