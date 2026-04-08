import { describe, it, expect, beforeEach } from 'vitest'
import { Quad2D } from '../../gameObject/renderables/Quad2D'
import { makeMockRenderableInitArgs, type MockRenderableInitArgs } from './mockRenderableInitArgs'
import type { MockGPUBuffer } from '../buffers/mockDevice'

const QUAD_OPTIONS = {
  x: 0.1,
  y: 0.2,
  width: 0.5,
  height: 0.3,
  color: [1, 0, 0, 1] as [number, number, number, number],
}

let mock: MockRenderableInitArgs

beforeEach(() => {
  mock = makeMockRenderableInitArgs()
})

// ── Pre-init identity ──────────────────────────────────────────────────────────

describe('Quad2D — pre-init identity', () => {
  it('id is a symbol', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(typeof quad.id).toBe('symbol')
  })

  it('layer is "overlay"', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.layer).toBe('overlay')
  })

  it('pipelineKey is "quad2d"', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.pipelineKey).toBe('quad2d')
  })

  it('visible is true by default', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.visible).toBe(true)
  })

  it('color getter returns opts.color', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.color).toEqual([1, 0, 0, 1])
  })
})

// ── init() GPU setup ───────────────────────────────────────────────────────────

describe('Quad2D — init() GPU setup', () => {
  it('calls uniformPool.allocate with 80', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.uniformPool.allocate).toHaveBeenCalledWith(80)
  })

  it('calls uniformPool.write once', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.uniformPool.write).toHaveBeenCalledOnce()
  })

  it('calls device.createBuffer twice (vertex buffer + index buffer)', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.device.createBuffer).toHaveBeenCalledTimes(2)
  })

  it('calls device.createBindGroup once', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(mock.device.createBindGroup).toHaveBeenCalledOnce()
  })

  it('calls pipelineCache.getOrCreateRender with key "quad2d"', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    const getOrCreate = mock.pipelineCache.getOrCreateRender
    expect(getOrCreate).toHaveBeenCalledWith('quad2d', expect.anything())
  })
})

// ── setColor() ─────────────────────────────────────────────────────────────────

describe('Quad2D — setColor()', () => {
  it('color getter returns updated values after setColor', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    quad.setColor(0, 0, 1, 1)
    expect(quad.color).toEqual([0, 0, 1, 1])
  })

  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setColor(0, 0, 1, 1)
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setRect() ─────────────────────────────────────────────────────────────────

describe('Quad2D — setRect()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setRect(0.5, 0.5, 0.2, 0.2)
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })

  it('does not throw', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    expect(() => quad.setRect(0, 0, 1, 1)).not.toThrow()
  })
})

// ── setPosition() ──────────────────────────────────────────────────────────────

describe('Quad2D — setPosition()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setPosition([0.3, 0.4, 0])
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setScale() ─────────────────────────────────────────────────────────────────

describe('Quad2D — setScale()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setScale(2, 2, 1)
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── setQuaternion() ────────────────────────────────────────────────────────────

describe('Quad2D — setQuaternion()', () => {
  it('triggers device.queue.writeBuffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    mock.device.queue.writeBuffer.mockClear()
    quad.setQuaternion([0, 0, 0, 1])
    expect(mock.device.queue.writeBuffer).toHaveBeenCalled()
  })
})

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('Quad2D — destroy()', () => {
  it('calls destroy() on the vertex buffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    const vertexGPUBuffer = mock.device.createBuffer.mock.results[0].value as MockGPUBuffer
    quad.destroy()
    expect(vertexGPUBuffer.destroy).toHaveBeenCalledOnce()
  })

  it('calls destroy() on the index buffer', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    quad.init(mock.args)
    const indexGPUBuffer = mock.device.createBuffer.mock.results[1].value as MockGPUBuffer
    quad.destroy()
    expect(indexGPUBuffer.destroy).toHaveBeenCalledOnce()
  })
})

// ── clone() ────────────────────────────────────────────────────────────────────

describe('Quad2D — clone()', () => {
  it('returns a Quad2D instance', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.clone()).toBeInstanceOf(Quad2D)
  })

  it('has a different id than the original', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.clone().id).not.toBe(quad.id)
  })

  it('is a different reference than the original', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.clone()).not.toBe(quad)
  })

  it('preserves original color in the new instance', () => {
    const quad = new Quad2D(QUAD_OPTIONS)
    expect(quad.clone().color).toEqual([1, 0, 0, 1])
  })
})
