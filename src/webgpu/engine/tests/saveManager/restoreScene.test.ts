import { describe, it, expect, vi, beforeEach } from 'vitest'
import { restoreFromSnapshot } from '../../saveManager/restoreScene'
import type { SceneSnapshot } from '../../saveManager/types'
import type { Engine } from '../../Engine'

// ── Mock engine factory ───────────────────────────────────────────────────────

function makeMockLight() {
  return {
    setPosition:  vi.fn(),
    setColor:     vi.fn(),
    setDirection: vi.fn(),
    getRigidbody: vi.fn().mockReturnValue(null),
  }
}

function makeMockGameObject(rigidbody: unknown = null) {
  return { getRigidbody: vi.fn().mockReturnValue(rigidbody) }
}

function makeMockEngine() {
  const mockCamera = {}
  return {
    createCamera:          vi.fn().mockReturnValue(mockCamera),
    setCamera:             vi.fn(),
    createMesh:            vi.fn().mockReturnValue(makeMockGameObject()),
    createQuad3D:          vi.fn().mockReturnValue(makeMockGameObject()),
    createFbxModel:        vi.fn().mockReturnValue(makeMockGameObject()),
    loadFbx:               vi.fn().mockResolvedValue({ _fakeFbxAsset: true }),
    createPointLight:      vi.fn().mockReturnValue(makeMockLight()),
    createAmbientLight:    vi.fn().mockReturnValue(makeMockLight()),
    createDirectionalLight: vi.fn().mockReturnValue(makeMockLight()),
    onFrame:               vi.fn(),
  } as unknown as Engine
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CAMERA_FIXTURE = {
  position: [1, 2, 3] as [number, number, number],
  yaw:   0.5,
  pitch: -0.2,
}

const BASE_OBJECT = {
  label:         'obj',
  properties:    [] as string[],
  physicsConfig: { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  position:      [0, 0, 0]    as [number, number, number],
  quaternion:    [0, 0, 0, 1] as [number, number, number, number],
  scale:         [1, 1, 1]    as [number, number, number],
  color:         [1, 0, 0, 1] as [number, number, number, number],
}

function makeSnapshot(objects: SceneSnapshot['objects'] = []): SceneSnapshot {
  return { version: 1, camera: CAMERA_FIXTURE, objects }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let engine: Engine

beforeEach(() => {
  engine = makeMockEngine()
})

// ── Camera ─────────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — camera', () => {
  it('creates a camera with position/yaw/pitch from the snapshot', async () => {
    await restoreFromSnapshot(engine, makeSnapshot())
    expect(engine.createCamera).toHaveBeenCalledWith({
      position: [1, 2, 3],
      yaw:   0.5,
      pitch: -0.2,
    })
  })

  it('calls setCamera with the created camera', async () => {
    await restoreFromSnapshot(engine, makeSnapshot())
    const createdCamera = (engine.createCamera as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(engine.setCamera).toHaveBeenCalledWith(createdCamera)
  })
})

// ── Cube ───────────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — Cube', () => {
  it('calls createMesh for a Cube record', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT }]))
    expect(engine.createMesh).toHaveBeenCalledOnce()
  })

  it('passes color from the snapshot into the cube vertices', async () => {
    const color: [number, number, number, number] = [0.1, 0.2, 0.3, 1.0]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT, color }]))
    const call = (engine.createMesh as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // vertices[8..11] are the color of the first vertex
    expect(call.renderable.vertices[8]).toBeCloseTo(0.1)
    expect(call.renderable.vertices[9]).toBeCloseTo(0.2)
    expect(call.renderable.vertices[10]).toBeCloseTo(0.3)
  })

  it('passes position, quaternion, and scale', async () => {
    const position:  [number, number, number]         = [1, 2, 3]
    const quaternion: [number, number, number, number] = [0, 0, 0, 1]
    const scale:     [number, number, number]         = [2, 3, 4]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT, position, quaternion, scale }]))
    const call = (engine.createMesh as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.position).toEqual([1, 2, 3])
    expect(call.quaternion).toEqual([0, 0, 0, 1])
    expect(call.scale).toEqual([2, 3, 4])
  })
})

// ── Quad ───────────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — Quad', () => {
  it('calls createQuad3D for a Quad record', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Quad', ...BASE_OBJECT }]))
    expect(engine.createQuad3D).toHaveBeenCalledOnce()
  })

  it('maps scale[0] to width and scale[2] to height', async () => {
    const scale: [number, number, number] = [3, 1, 5]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Quad', ...BASE_OBJECT, scale }]))
    const call = (engine.createQuad3D as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.renderable.width).toBe(3)
    expect(call.renderable.height).toBe(5)
  })

  it('passes color into the quad renderable', async () => {
    const color: [number, number, number, number] = [0.5, 0.6, 0.7, 1.0]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Quad', ...BASE_OBJECT, color }]))
    const call = (engine.createQuad3D as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.renderable.color).toEqual([0.5, 0.6, 0.7, 1.0])
  })
})

// ── FBX ───────────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — FBX', () => {
  const fbxRecord = { key: 'FBX' as const, assetUrl: 'https://example.com/model.fbx', ...BASE_OBJECT }

  it('calls loadFbx with the assetUrl', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([fbxRecord]))
    expect(engine.loadFbx).toHaveBeenCalledWith('https://example.com/model.fbx')
  })

  it('calls createFbxModel with the loaded asset', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([fbxRecord]))
    const loadedAsset = (engine.loadFbx as ReturnType<typeof vi.fn>).mock.results[0].value
    const call = (engine.createFbxModel as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.renderable.asset).toBe(await loadedAsset)
  })

  it('calls loadFbx only once when two records share the same URL', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([fbxRecord, fbxRecord]))
    expect(engine.loadFbx).toHaveBeenCalledOnce()
  })

  it('calls loadFbx twice for two records with different URLs', async () => {
    const second = { ...fbxRecord, assetUrl: 'https://example.com/other.fbx' }
    await restoreFromSnapshot(engine, makeSnapshot([fbxRecord, second]))
    expect(engine.loadFbx).toHaveBeenCalledTimes(2)
  })
})

// ── Lights ─────────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — lights', () => {
  const BASE_LIGHT = {
    ...BASE_OBJECT,
    radius:    5,
    direction: [0, -1, 0] as [number, number, number],
  }

  it('calls createPointLight for lightType 1', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Light', lightType: 1, ...BASE_LIGHT }]))
    expect(engine.createPointLight).toHaveBeenCalledWith({ radius: 5 })
  })

  it('calls createAmbientLight for lightType 0', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Light', lightType: 0, ...BASE_LIGHT }]))
    expect(engine.createAmbientLight).toHaveBeenCalledOnce()
  })

  it('calls createDirectionalLight for DirectionalLight key', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'DirectionalLight', lightType: 2, ...BASE_LIGHT }]))
    expect(engine.createDirectionalLight).toHaveBeenCalledOnce()
  })

  it('calls setPosition on the light with the record position', async () => {
    const position: [number, number, number] = [3, 4, 5]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Light', lightType: 1, ...BASE_LIGHT, position }]))
    const light = (engine.createPointLight as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(light.setPosition).toHaveBeenCalledWith([3, 4, 5])
  })

  it('calls setColor on the light with the record color', async () => {
    const color: [number, number, number, number] = [1, 0.5, 0, 1]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Light', lightType: 1, ...BASE_LIGHT, color }]))
    const light = (engine.createPointLight as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(light.setColor).toHaveBeenCalledWith(1, 0.5, 0, 1)
  })

  it('calls setDirection on the light', async () => {
    const direction: [number, number, number] = [1, 0, 0]
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'DirectionalLight', lightType: 2, ...BASE_LIGHT, direction }]))
    const light = (engine.createDirectionalLight as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(light.setDirection).toHaveBeenCalledWith([1, 0, 0])
  })
})

// ── Physics ───────────────────────────────────────────────────────────────────

describe('restoreFromSnapshot — physics', () => {
  it('calls onFrame with a function when at least one object has a rigidbody', async () => {
    const physicsConfig = { hasRigidbody: true, isStatic: false, hasHitbox: false, layer: 'default' }
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT, physicsConfig }]))
    expect(engine.onFrame).toHaveBeenCalledWith(expect.any(Function))
  })

  it('still calls onFrame even when no objects have rigidbodies', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT }]))
    expect(engine.onFrame).toHaveBeenCalledWith(expect.any(Function))
  })

  it('passes no rigidbody to createMesh when hasRigidbody is false', async () => {
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT }]))
    const call = (engine.createMesh as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.rigidbody).toBeUndefined()
  })

  it('passes a rigidbody to createMesh when hasRigidbody is true', async () => {
    const physicsConfig = { hasRigidbody: true, isStatic: false, hasHitbox: false, layer: 'default' }
    await restoreFromSnapshot(engine, makeSnapshot([{ key: 'Cube', ...BASE_OBJECT, physicsConfig }]))
    const call = (engine.createMesh as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.rigidbody).toBeDefined()
  })
})
