import { describe, it, expect, beforeEach } from 'vitest';
import { Mesh } from '../../gameObject/renderables/Mesh';
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs';
import type { MockGPUBuffer } from '../buffers/mockDevice';

const VERTEX_FIXTURE = new Float32Array(12);   // 1 vertex × 48 bytes
const INDEX_FIXTURE  = new Uint32Array([0, 1, 2]);

let mock: MockRenderableInitArgs;

beforeEach(() => {
  mock = makeMockRenderableInitArgs();
});

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('Mesh — pre-init identity', () => {
  it('id is a symbol', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(typeof mesh.id).toBe('symbol');
  });

  it('layer is "world"', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.layer).toBe('world');
  });

  it('pipelineKey is "mesh"', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.pipelineKey).toBe('mesh');
  });

  it('visible is true by default', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.visible).toBe(true);
  });

  it('color getter returns [1, 1, 1, 1] before init', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.color).toEqual([1, 1, 1, 1]);
  });

  it('clone() returns a different reference', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.clone()).not.toBe(mesh);
  });

  it('clone() result has a different id', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.clone().id).not.toBe(mesh.id);
  });
});

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('Mesh — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80);
  });

  it('calls uniformPool.write once', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    expect(mock.uniformPool.write).toHaveBeenCalledOnce();
  });

  it('calls device.createBuffer once when no indices are provided', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(1);
  });

  it('calls device.createBuffer twice when indices are provided', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE, indices: INDEX_FIXTURE });
    mesh.init(mock.args);
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('calls device.createBindGroup once', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    expect(mock.device.createBindGroup).toHaveBeenCalledOnce();
  });

  it('calls pipelineCache.getOrCreateRender with key "mesh"', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    const getOrCreate = mock.pipelineCache.getOrCreateRender;
    expect(getOrCreate).toHaveBeenCalledWith('mesh', expect.anything());
  });

  it('when indices provided: calls queue.writeBuffer with the index data', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE, indices: INDEX_FIXTURE });
    mesh.init(mock.args);
    const calls = mock.device.queue.writeBuffer.mock.calls;
    const indexCall = calls.find(([, , data]) => data === INDEX_FIXTURE);
    expect(indexCall).toBeDefined();
  });
});

// ── setColor() ─────────────────────────────────────────────────────────────────

describe('Mesh — setColor()', () => {
  it('color getter returns [r, g, b, a] after setColor', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mesh.setColor(0.1, 0.2, 0.3, 0.4);
    expect(mesh.color[0]).toBeCloseTo(0.1, 4);
    expect(mesh.color[1]).toBeCloseTo(0.2, 4);
    expect(mesh.color[2]).toBeCloseTo(0.3, 4);
    expect(mesh.color[3]).toBeCloseTo(0.4, 4);
  });

  it('triggers device.queue.writeBuffer', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    mesh.setColor(1, 0, 0, 1);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setPosition() ──────────────────────────────────────────────────────────────

describe('Mesh — setPosition()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    mesh.setPosition([1, 2, 3]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setQuaternion() ────────────────────────────────────────────────────────────

describe('Mesh — setQuaternion()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    mesh.setQuaternion([0, 0, 0.707, 0.707]);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setScale() ─────────────────────────────────────────────────────────────────

describe('Mesh — setScale()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    mesh.setScale(2, 2, 2);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setVertices() ──────────────────────────────────────────────────────────────

describe('Mesh — setVertices()', () => {
  it('calls queue.writeBuffer with the new vertex data', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    const newVertices = new Float32Array(24);  // 2 vertices × 48 bytes
    mesh.setVertices(newVertices);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled();
  });
});

// ── setIndices() buffer management ────────────────────────────────────────────

describe('Mesh — setIndices() buffer management', () => {
  it('creates a new GPU buffer when no index buffer existed', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    const countBeforeSetIndices = mock.device.createBuffer.mock.calls.length;
    mesh.setIndices(INDEX_FIXTURE);
    expect(mock.device.createBuffer.mock.calls.length).toBe(countBeforeSetIndices + 1);
  });

  it('calls queue.writeBuffer with the new index data', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mock.device.queue.writeBuffer.mockClear();
    mesh.setIndices(INDEX_FIXTURE);
    expect(mock.device.queue.writeBuffer).toHaveBeenCalledWith(
      expect.anything(), 0, expect.anything()
    );
  });

  it('destroys the old buffer and creates a new one when data grows larger', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    const smallIndices = new Uint32Array([0, 1, 2]);         // 12 bytes
    mesh.setIndices(smallIndices);
    const firstIndexBuffer = mock.device.createBuffer.mock.results[
      mock.device.createBuffer.mock.results.length - 1
    ].value as MockGPUBuffer;

    const largeIndices = new Uint32Array(12);                 // 48 bytes — exceeds 12
    mesh.setIndices(largeIndices);

    expect(firstIndexBuffer.destroy).toHaveBeenCalledOnce();
    expect(mock.device.createBuffer.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('Mesh — destroy()', () => {
  it('calls destroy() on the vertex buffer', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    const vertexGPUBuffer = mock.device.createBuffer.mock.results[0].value as MockGPUBuffer;
    mesh.destroy();
    expect(vertexGPUBuffer.destroy).toHaveBeenCalledOnce();
  });

  it('calls destroy() on the index buffer when indices were provided', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE, indices: INDEX_FIXTURE });
    mesh.init(mock.args);
    const indexGPUBuffer = mock.device.createBuffer.mock.results[1].value as MockGPUBuffer;
    mesh.destroy();
    expect(indexGPUBuffer.destroy).toHaveBeenCalledOnce();
  });

  it('does not throw when no index buffer was created', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    expect(() => mesh.destroy()).not.toThrow();
  });
});

// ── clone() ────────────────────────────────────────────────────────────────────

describe('Mesh — clone()', () => {
  it('returns a Mesh instance', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.clone()).toBeInstanceOf(Mesh);
  });

  it('result has a different id than the original', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.clone().id).not.toBe(mesh.id);
  });

  it('result is a different reference than the original', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    expect(mesh.clone()).not.toBe(mesh);
  });

  it('clone is not yet initialised — color reads [1, 1, 1, 1]', () => {
    const mesh = new Mesh({ vertices: VERTEX_FIXTURE });
    mesh.init(mock.args);
    mesh.setColor(0.5, 0.5, 0.5, 0.5);
    const cloned = mesh.clone();
    expect(cloned.color).toEqual([1, 1, 1, 1]);
  });
});
