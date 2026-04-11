import { describe, it, expect, beforeEach } from 'vitest';
import { Model3D } from '../../gameObject/renderables/Model3D';
import { ModelAsset } from '../../gameObject/renderables/ModelAsset';
import { makeMockDevice } from '../buffers/mockDevice';
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs';

function makeMockModelAsset(): ModelAsset {
  const assetDevice = makeMockDevice();
  return new ModelAsset(
    assetDevice as unknown as GPUDevice,
    assetDevice.queue as unknown as GPUQueue,
    new Float32Array(48 * 3),
    new Uint32Array([0, 1, 2]),
  );
}

let mock: MockRenderableInitArgs;
let asset: ModelAsset;

beforeEach(() => {
  mock = makeMockRenderableInitArgs();
  asset = makeMockModelAsset();
});

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('Model3D — pre-init identity', () => {
  it('id is a symbol', () => {
    const model = new Model3D({ asset });
    expect(typeof model.id).toBe('symbol');
  });

  it('layer is "world"', () => {
    const model = new Model3D({ asset });
    expect(model.layer).toBe('world');
  });

  it('pipelineKey is "mesh"', () => {
    const model = new Model3D({ asset });
    expect(model.pipelineKey).toBe('mesh');
  });

  it('visible is true by default', () => {
    const model = new Model3D({ asset });
    expect(model.visible).toBe(true);
  });

  it('color getter returns [1, 1, 1, 1] when no tint is provided', () => {
    const model = new Model3D({ asset });
    expect(model.color).toEqual([1, 1, 1, 1]);
  });

  it('color getter returns opts.tint when a custom tint is provided', () => {
    const model = new Model3D({ asset, tint: [0.5, 0.2, 0.8, 1] });
    expect(model.color[0]).toBeCloseTo(0.5, 4);
    expect(model.color[1]).toBeCloseTo(0.2, 4);
    expect(model.color[2]).toBeCloseTo(0.8, 4);
    expect(model.color[3]).toBeCloseTo(1, 4);
  });
});

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('Model3D — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80);
  });

  it('calls uniformPool.write once', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    expect(mock.uniformPool.write).toHaveBeenCalledOnce();
  });

  it('calls device.createBindGroup once', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    expect(mock.device.createBindGroup).toHaveBeenCalledOnce();
  });

  it('calls pipelineCache.getOrCreateRender with key "mesh"', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    const getOrCreate = mock.pipelineCache.getOrCreateRender;
    expect(getOrCreate).toHaveBeenCalledWith('mesh', expect.anything());
  });

  it('does NOT call device.createBuffer — asset owns vertex and index buffers', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    expect(mock.device.createBuffer).not.toHaveBeenCalled();
  });
});

// ── setColor() ─────────────────────────────────────────────────────────────────

describe('Model3D — setColor()', () => {
  it('color getter reflects new values after setColor', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    model.setColor(0.1, 0.3, 0.5, 0.7);
    expect(model.color[0]).toBeCloseTo(0.1, 4);
    expect(model.color[1]).toBeCloseTo(0.3, 4);
    expect(model.color[2]).toBeCloseTo(0.5, 4);
    expect(model.color[3]).toBeCloseTo(0.7, 4);
  });

  it('triggers device.queue.writeBuffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    model.setColor(1, 0, 0, 1);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setPosition() ──────────────────────────────────────────────────────────────

describe('Model3D — setPosition()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    model.setPosition([10, 0, -5]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setScale() ─────────────────────────────────────────────────────────────────

describe('Model3D — setScale()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    model.setScale(2, 2, 2);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setQuaternion() ────────────────────────────────────────────────────────────

describe('Model3D — setQuaternion()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    model.setQuaternion([0, 0, 0.707, 0.707]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('Model3D — destroy()', () => {
  it('does not throw', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    expect(() => model.destroy()).not.toThrow();
  });

  it('does not call destroy() on the asset vertex buffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    const vertexBufferDestroy = (asset.vertexBuf as unknown as { destroy: ReturnType<typeof import('vitest').vi.fn> }).destroy;
    model.destroy();
    expect(vertexBufferDestroy).not.toHaveBeenCalled();
  });

  it('does not call destroy() on the asset index buffer', () => {
    const model = new Model3D({ asset });
    model.init(mock.args);
    const indexBufferDestroy = (asset.indexBuf as unknown as { destroy: ReturnType<typeof import('vitest').vi.fn> }).destroy;
    model.destroy();
    expect(indexBufferDestroy).not.toHaveBeenCalled();
  });
});

// ── clone() ────────────────────────────────────────────────────────────────────

describe('Model3D — clone()', () => {
  it('returns a Model3D instance', () => {
    const model = new Model3D({ asset });
    expect(model.clone()).toBeInstanceOf(Model3D);
  });

  it('has a different id than the original', () => {
    const model = new Model3D({ asset });
    expect(model.clone().id).not.toBe(model.id);
  });

  it('is a different reference than the original', () => {
    const model = new Model3D({ asset });
    expect(model.clone()).not.toBe(model);
  });

  it('shares the same asset reference as the original', () => {
    const model = new Model3D({ asset });
    const cloned = model.clone();
    expect((cloned as unknown as { _asset: unknown })._asset).toBe((model as unknown as { _asset: unknown })._asset);
  });

  it('preserves the default tint color', () => {
    const model = new Model3D({ asset });
    expect(model.clone().color).toEqual([1, 1, 1, 1]);
  });

  it('preserves a custom tint color', () => {
    const model = new Model3D({ asset, tint: [0.3, 0.6, 0.9, 1] });
    expect(model.clone().color[0]).toBeCloseTo(0.3, 4);
    expect(model.clone().color[1]).toBeCloseTo(0.6, 4);
    expect(model.clone().color[2]).toBeCloseTo(0.9, 4);
    expect(model.clone().color[3]).toBeCloseTo(1, 4);
  });
});
