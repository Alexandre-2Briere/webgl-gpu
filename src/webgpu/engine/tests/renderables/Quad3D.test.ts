import { describe, it, expect, beforeEach } from 'vitest'
import { Quad3D } from '../../gameObject/renderables/Quad3D'
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs'
import type { MockGPUBuffer } from '../buffers/mockDevice'

const QUAD_OPTIONS = {
  width: 2,
  height: 1,
  color: [0, 1, 0, 1] as [number, number, number, number],
}

const QUAD_OPTIONS_WITH_NORMAL = {
  ...QUAD_OPTIONS,
  normal: [0, 0, 1] as [number, number, number],
}

let mock: MockRenderableInitArgs

beforeEach(() => {
  mock = makeMockRenderableInitArgs()
})

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('Quad3D — pre-init identity', () => {
  it('id is a symbol', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(typeof quad.id).toBe('symbol')
  })

  it('layer is "world"', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.layer).toBe('world')
  })

  it('pipelineKey is "quad3d"', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.pipelineKey).toBe('quad3d')
  })

  it('visible is true by default', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.visible).toBe(true)
  })

  it('color getter returns opts.color', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.color).toEqual([0, 1, 0, 1])
  })
})

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('Quad3D — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80)
  })

  it('calls uniformPool.write once', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.uniformPool.write).toHaveBeenCalledOnce()
  })

  it('calls device.createBuffer twice (vertex buffer + index buffer)', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(2)
  })

  it('calls device.createBindGroup once', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.device.createBindGroup).toHaveBeenCalledOnce()
  })

  it('calls pipelineCache.getOrCreateRender with key "quad3d"', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    const getOrCreate = (mock.args.pipelineCache as any).getOrCreateRender
    expect(getOrCreate).toHaveBeenCalledWith('quad3d', expect.anything())
  })

  it('does not throw when normal is omitted (defaults to [0, 1, 0])', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(() => quad.init(mock.args)).not.toThrow()
  })

  it('does not throw when an explicit normal is provided', () => {
    const quad = new Quad3D(QUAD_OPTIONS_WITH_NORMAL)
    expect(() => quad.init(mock.args)).not.toThrow()
  })
})

// ── setColor() ─────────────────────────────────────────────────────────────────

describe('Quad3D — setColor()', () => {
  it('color getter reflects new values after setColor', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    quad.setColor(0.2, 0.4, 0.6, 0.8)
    expect(quad.color[0]).toBeCloseTo(0.2, 4)
    expect(quad.color[1]).toBeCloseTo(0.4, 4)
    expect(quad.color[2]).toBeCloseTo(0.6, 4)
    expect(quad.color[3]).toBeCloseTo(0.8, 4)
  })

  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setColor(1, 1, 0, 1)
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setPosition() ──────────────────────────────────────────────────────────────

describe('Quad3D — setPosition()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setPosition([5, 0, -3])
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setScale() ─────────────────────────────────────────────────────────────────

describe('Quad3D — setScale()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setScale(3, 3, 3)
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setQuaternion() ────────────────────────────────────────────────────────────

describe('Quad3D — setQuaternion()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setQuaternion([0, 0, 0, 1])
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('Quad3D — destroy()', () => {
  it('calls destroy() on the vertex buffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    const vertexGPUBuffer = mock.device.createBuffer.mock.results[0].value as MockGPUBuffer
    quad.destroy()
    expect(vertexGPUBuffer.destroy).toHaveBeenCalledOnce()
  })

  it('calls destroy() on the index buffer', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    quad.init(mock.args)
    const indexGPUBuffer = mock.device.createBuffer.mock.results[1].value as MockGPUBuffer
    quad.destroy()
    expect(indexGPUBuffer.destroy).toHaveBeenCalledOnce()
  })
})

// ── clone() ────────────────────────────────────────────────────────────────────

describe('Quad3D — clone()', () => {
  it('returns a Quad3D instance', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.clone()).toBeInstanceOf(Quad3D)
  })

  it('has a different id than the original', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.clone().id).not.toBe(quad.id)
  })

  it('is a different reference than the original', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.clone()).not.toBe(quad)
  })

  it('preserves color from original opts', () => {
    const quad = new Quad3D(QUAD_OPTIONS)
    expect(quad.clone().color).toEqual([0, 1, 0, 1])
  })
})
