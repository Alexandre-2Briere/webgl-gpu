import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SaveManager } from '../../saveManager/SaveManager'
import { logger } from '../../utils/logger'
import type {
  SceneSnapshot,
  CubeSnapshot,
  QuadSnapshot,
  FbxObjectSnapshot,
  LightSnapshot,
  DirectionalLightSnapshot,
} from '../../saveManager/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CAMERA_FIXTURE = {
  position: [1, 2, 3] as [number, number, number],
  yaw: 0.5,
  pitch: -0.2,
}

const VALID_SNAPSHOT: SceneSnapshot = {
  version: 1,
  camera: CAMERA_FIXTURE,
  objects: [],
}

const BASE_OBJECT = {
  label:         'object',
  properties:    [] as string[],
  physicsConfig: { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  position:      [0, 0, 0]    as [number, number, number],
  quaternion:    [0, 0, 0, 1] as [number, number, number, number],
  scale:         [1, 1, 1]    as [number, number, number],
  color:         [1, 1, 1, 1] as [number, number, number, number],
}

const CUBE_OBJECT: CubeSnapshot = { key: 'Cube', ...BASE_OBJECT }
const QUAD_OBJECT: QuadSnapshot = { key: 'Quad', ...BASE_OBJECT }

const FBX_OBJECT: FbxObjectSnapshot = {
  key:      'FBX',
  assetUrl: 'https://example.com/model.fbx',
  ...BASE_OBJECT,
}

const LIGHT_OBJECT: LightSnapshot = {
  key:       'Light',
  lightType: 1,
  radius:    5,
  direction: [0, -1, 0],
  ...BASE_OBJECT,
}

const DIRECTIONAL_LIGHT_OBJECT: DirectionalLightSnapshot = {
  key:       'DirectionalLight',
  lightType: 2,
  radius:    10,
  direction: [1, 0, 0],
  ...BASE_OBJECT,
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Compresses an arbitrary string and returns Base64, mirroring SaveManager.save() internals. */
async function encodeRaw(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str)
  const compressionStream = new CompressionStream('deflate')
  const writer = compressionStream.writable.getWriter()
  writer.write(encoded)
  writer.close()
  const buffer = await new Response(compressionStream.readable).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return btoa(String.fromCharCode(...bytes))
}

/** Decodes a real encoded string, removes trailing bytes, re-encodes as Base64. */
async function truncateEncoded(encoded: string): Promise<string> {
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const truncated = bytes.slice(0, bytes.length - 10)
  return btoa(String.fromCharCode(...truncated))
}

// ── Per-test setup ────────────────────────────────────────────────────────────

let manager: SaveManager

beforeEach(() => {
  manager = new SaveManager()
  vi.spyOn(logger, 'error').mockImplementation(() => {})
  vi.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── save() ────────────────────────────────────────────────────────────────────

describe('SaveManager — save()', () => {
  it('returns a non-empty string', async () => {
    const result = await manager.save(VALID_SNAPSHOT)
    expect(result.length).toBeGreaterThan(0)
  })

  it('result contains only valid Base64 characters', async () => {
    const result = await manager.save(VALID_SNAPSHOT)
    expect(result).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('logs info on success', async () => {
    await manager.save(VALID_SNAPSHOT)
    expect(logger.info).toHaveBeenCalled()
  })

  it('logs error when encoded size exceeds 5 MB limit', async () => {
    vi.spyOn(globalThis, 'btoa').mockReturnValue('A'.repeat(5_000_001))
    await manager.save(VALID_SNAPSHOT)
    expect(logger.error).toHaveBeenCalled()
  })
})

// ── save() / load() round-trip ─────────────────────────────────────────────────

describe('SaveManager — save() / load() round-trip', () => {
  it('empty objects array survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SNAPSHOT))
    expect(result).toEqual(VALID_SNAPSHOT)
  })

  it('camera position survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SNAPSHOT))
    expect(result?.camera.position).toEqual([1, 2, 3])
  })

  it('camera yaw survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SNAPSHOT))
    expect(result?.camera.yaw).toBeCloseTo(0.5, 5)
  })

  it('camera pitch survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SNAPSHOT))
    expect(result?.camera.pitch).toBeCloseTo(-0.2, 5)
  })

  it('all five object types survive round-trip', async () => {
    const snapshot: SceneSnapshot = {
      version: 1,
      camera:  CAMERA_FIXTURE,
      objects: [CUBE_OBJECT, QUAD_OBJECT, FBX_OBJECT, LIGHT_OBJECT, DIRECTIONAL_LIGHT_OBJECT],
    }
    const result = await manager.load(await manager.save(snapshot))
    expect(result?.objects).toEqual(snapshot.objects)
  })
})

// ── load() — Base64 decode failure ─────────────────────────────────────────────

describe('SaveManager — load() — Base64 decode failure', () => {
  it('returns null for an empty string', async () => {
    expect(await manager.load('')).toBeNull()
  })

  it('logs error for a string with invalid Base64 structure', async () => {
    await manager.load('@@@')
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decode base64 string:',
      expect.anything()
    )
  })

  it('returns null for a string with invalid Base64 characters', async () => {
    expect(await manager.load('!!!not-base64!!!')).toBeNull()
  })

  it('logs error for a string with invalid Base64 characters', async () => {
    await manager.load('!!!not-base64!!!')
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decode base64 string:',
      expect.anything()
    )
  })

  it('returns null for a whitespace-only string', async () => {
    expect(await manager.load('   ')).toBeNull()
  })
})

// ── load() — decompression failure ─────────────────────────────────────────────

describe('SaveManager — load() — decompression failure', () => {
  it('returns null for valid Base64 that is not deflate-compressed', async () => {
    const notCompressed = btoa('hello world not deflate compressed data')
    expect(await manager.load(notCompressed)).toBeNull()
  })

  it('logs error for valid Base64 that is not deflate-compressed', async () => {
    const notCompressed = btoa('hello world not deflate compressed data')
    await manager.load(notCompressed)
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decompress data:',
      expect.anything()
    )
  })

  it('returns null for a truncated compressed stream', async () => {
    const truncated = await truncateEncoded(await manager.save(VALID_SNAPSHOT))
    expect(await manager.load(truncated)).toBeNull()
  })

  it('logs error for a truncated compressed stream', async () => {
    const truncated = await truncateEncoded(await manager.save(VALID_SNAPSHOT))
    await manager.load(truncated)
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decompress data:',
      expect.anything()
    )
  })
})

// ── load() — JSON parse failure ─────────────────────────────────────────────────

describe('SaveManager — load() — JSON parse failure', () => {
  it('returns null for valid compressed data that is not JSON', async () => {
    expect(await manager.load(await encodeRaw('not { json at all }}}'))).toBeNull()
  })

  it('logs error for valid compressed data that is not JSON', async () => {
    await manager.load(await encodeRaw('not { json at all }}}'))
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to parse JSON:',
      expect.anything()
    )
  })
})

// ── load() — schema validation: root ──────────────────────────────────────────

describe('SaveManager — load() — schema validation: root', () => {
  it('returns null when root is null', async () => {
    expect(await manager.load(await encodeRaw('null'))).toBeNull()
  })

  it('returns null when root is an array', async () => {
    expect(await manager.load(await encodeRaw('[]'))).toBeNull()
  })

  it('returns null when root is a number', async () => {
    expect(await manager.load(await encodeRaw('42'))).toBeNull()
  })

  it('returns null when version field is missing', async () => {
    const payload = JSON.stringify({ camera: CAMERA_FIXTURE, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when version is 0', async () => {
    const payload = JSON.stringify({ version: 0, camera: CAMERA_FIXTURE, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when version is 2', async () => {
    const payload = JSON.stringify({ version: 2, camera: CAMERA_FIXTURE, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('logs error with "Invalid snapshot schema" for root-level violations', async () => {
    await manager.load(await encodeRaw('null'))
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Invalid snapshot schema:',
      expect.anything()
    )
  })
})

// ── load() — schema validation: camera ────────────────────────────────────────

describe('SaveManager — load() — schema validation: camera', () => {
  it('returns null when camera field is missing', async () => {
    const payload = JSON.stringify({ version: 1, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when camera is null', async () => {
    const payload = JSON.stringify({ version: 1, camera: null, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when camera.position is missing', async () => {
    const payload = JSON.stringify({ version: 1, camera: { yaw: 0, pitch: 0 }, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when camera.position is a string instead of an array', async () => {
    const payload = JSON.stringify({ version: 1, camera: { position: '0,0,0', yaw: 0, pitch: 0 }, objects: [] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })
})

// ── load() — schema validation: objects array ─────────────────────────────────

describe('SaveManager — load() — schema validation: objects array', () => {
  it('returns null when objects field is missing', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects is a string', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: 'none' })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0] is null', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [null] })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].key is an unknown value', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Sphere', label: 'x', position: [], quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].key is undefined', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ label: 'x', position: [], quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].label is missing', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Cube', position: [], quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].label is a number', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Cube', label: 42, position: [], quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].position is missing', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Cube', label: 'x', quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].position is an object instead of an array', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Cube', label: 'x', position: { x: 0 }, quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when objects[0].quaternion is missing', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'Cube', label: 'x', position: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when only the second object in the array is invalid', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [
        { key: 'Cube', label: 'first', position: [], quaternion: [] },
        { key: 'Invalid', label: 'second', position: [], quaternion: [] },
      ],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })
})

// ── load() — schema validation: FBX-specific ─────────────────────────────────

describe('SaveManager — load() — schema validation: FBX-specific', () => {
  it('returns null when FBX object has no assetUrl', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [] }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when FBX assetUrl is a number', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [], assetUrl: 123 }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns null when FBX assetUrl is null', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [], assetUrl: null }],
    })
    expect(await manager.load(await encodeRaw(payload))).toBeNull()
  })

  it('returns a snapshot when FBX assetUrl is a valid string', async () => {
    const payload = JSON.stringify({
      version: 1, camera: CAMERA_FIXTURE,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [], assetUrl: 'model.fbx' }],
    })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })
})

// ── load() — all valid object keys accepted ────────────────────────────────────

describe('SaveManager — load() — valid object keys', () => {
  it('accepts key "Cube"', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [CUBE_OBJECT] })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })

  it('accepts key "Quad"', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [QUAD_OBJECT] })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })

  it('accepts key "FBX"', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [FBX_OBJECT] })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })

  it('accepts key "Light"', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [LIGHT_OBJECT] })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })

  it('accepts key "DirectionalLight"', async () => {
    const payload = JSON.stringify({ version: 1, camera: CAMERA_FIXTURE, objects: [DIRECTIONAL_LIGHT_OBJECT] })
    expect(await manager.load(await encodeRaw(payload))).not.toBeNull()
  })
})
