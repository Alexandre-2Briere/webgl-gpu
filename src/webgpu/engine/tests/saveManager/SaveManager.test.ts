import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../saveManager/SaveManager';
import { logger } from '../../utils/logger';
import type {
  SaveSegments,
  CubeSnapshot,
  QuadSnapshot,
  FbxObjectSnapshot,
  LightSnapshot,
  DirectionalLightSnapshot,
} from '../../saveManager/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CAMERA_FIXTURE = {
  position: [1, 2, 3] as [number, number, number],
  yaw: 0.5,
  pitch: -0.2,
};

const VALID_SEGMENTS: SaveSegments = {
  sceneConstants: [{ version: 1, camera: CAMERA_FIXTURE }],
  gameObjects:    [{ version: 1, objects: [] }],
  lightObjects:   [{ version: 1, objects: [] }],
};

const BASE_OBJECT = {
  label:         'object',
  properties:    [] as string[],
  physicsConfig: { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  position:      [0, 0, 0]    as [number, number, number],
  quaternion:    [0, 0, 0, 1] as [number, number, number, number],
  scale:         [1, 1, 1]    as [number, number, number],
  color:         [1, 1, 1, 1] as [number, number, number, number],
};

const CUBE_OBJECT: CubeSnapshot = { key: 'Cube', ...BASE_OBJECT };
const QUAD_OBJECT: QuadSnapshot = { key: 'Quad', ...BASE_OBJECT };

const FBX_OBJECT: FbxObjectSnapshot = {
  key:      'FBX',
  assetUrl: 'https://example.com/model.fbx',
  ...BASE_OBJECT,
};

const LIGHT_OBJECT: LightSnapshot = {
  key:       'Light',
  lightType: 1,
  radius:    5,
  direction: [0, -1, 0],
  ...BASE_OBJECT,
};

const DIRECTIONAL_LIGHT_OBJECT: DirectionalLightSnapshot = {
  key:       'DirectionalLight',
  lightType: 2,
  radius:    10,
  direction: [1, 0, 0],
  ...BASE_OBJECT,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compresses an arbitrary string and returns Base64, mirroring SaveManager._encode() internals. */
async function encodeRaw(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str);
  const compressionStream = new CompressionStream('deflate');
  const writer = compressionStream.writable.getWriter();
  writer.write(encoded);
  writer.close();
  const buffer = await new Response(compressionStream.readable).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

/** Wraps an already-encoded blob with a type tag for use with load(). */
function taggedSegment(tag: string, blob: string): string {
  return `${tag}:${blob}`;
}

/** Decodes a real encoded blob, removes trailing bytes, re-encodes as Base64. */
async function truncateBlob(encoded: string): Promise<string> {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const truncated = bytes.slice(0, bytes.length - 10);
  return btoa(String.fromCharCode(...truncated));
}

// ── Per-test setup ────────────────────────────────────────────────────────────

let manager: SaveManager;

beforeEach(() => {
  manager = new SaveManager();
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── save() ────────────────────────────────────────────────────────────────────

describe('SaveManager — save()', () => {
  it('returns a non-empty string', async () => {
    const result = await manager.save(VALID_SEGMENTS);
    expect(result.length).toBeGreaterThan(0);
  });

  it('result contains ||| separators between segments', async () => {
    const result = await manager.save(VALID_SEGMENTS);
    expect(result).toContain('|||');
  });

  it('each segment is prefixed with its type tag', async () => {
    const result = await manager.save(VALID_SEGMENTS);
    const pieces = result.split('|||');
    expect(pieces.some(piece => piece.startsWith('sceneConstants:'))).toBe(true);
    expect(pieces.some(piece => piece.startsWith('gameObjects:'))).toBe(true);
    expect(pieces.some(piece => piece.startsWith('lightObjects:'))).toBe(true);
  });

  it('each segment blob contains only valid Base64 characters', async () => {
    const result = await manager.save(VALID_SEGMENTS);
    const pieces = result.split('|||');
    for (const piece of pieces) {
      const blob = piece.slice(piece.indexOf(':') + 1);
      expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });

  it('logs info on success', async () => {
    await manager.save(VALID_SEGMENTS);
    expect(logger.info).toHaveBeenCalled();
  });

  it('logs error when encoded size exceeds 5 MB limit', async () => {
    vi.spyOn(globalThis, 'btoa').mockReturnValue('A'.repeat(5_000_001));
    await manager.save(VALID_SEGMENTS);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ── save() / load() round-trip ─────────────────────────────────────────────────

describe('SaveManager — save() / load() round-trip', () => {
  it('empty objects arrays survive round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SEGMENTS));
    expect(result?.sceneConstants[0].camera).toEqual(CAMERA_FIXTURE);
    expect(result?.gameObjects[0].objects).toEqual([]);
    expect(result?.lightObjects[0].objects).toEqual([]);
  });

  it('camera position survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SEGMENTS));
    expect(result?.sceneConstants[0].camera.position).toEqual([1, 2, 3]);
  });

  it('camera yaw survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SEGMENTS));
    expect(result?.sceneConstants[0].camera.yaw).toBeCloseTo(0.5, 5);
  });

  it('camera pitch survives round-trip', async () => {
    const result = await manager.load(await manager.save(VALID_SEGMENTS));
    expect(result?.sceneConstants[0].camera.pitch).toBeCloseTo(-0.2, 5);
  });

  it('game object types survive round-trip', async () => {
    const segments: SaveSegments = {
      sceneConstants: [{ version: 1, camera: CAMERA_FIXTURE }],
      gameObjects:    [{ version: 1, objects: [CUBE_OBJECT, QUAD_OBJECT, FBX_OBJECT] }],
      lightObjects:   [{ version: 1, objects: [] }],
    };
    const result = await manager.load(await manager.save(segments));
    expect(result?.gameObjects[0].objects).toEqual([CUBE_OBJECT, QUAD_OBJECT, FBX_OBJECT]);
  });

  it('light object types survive round-trip', async () => {
    const segments: SaveSegments = {
      sceneConstants: [{ version: 1, camera: CAMERA_FIXTURE }],
      gameObjects:    [{ version: 1, objects: [] }],
      lightObjects:   [{ version: 1, objects: [LIGHT_OBJECT, DIRECTIONAL_LIGHT_OBJECT] }],
    };
    const result = await manager.load(await manager.save(segments));
    expect(result?.lightObjects[0].objects).toEqual([LIGHT_OBJECT, DIRECTIONAL_LIGHT_OBJECT]);
  });
});

// ── load() — malformed format ─────────────────────────────────────────────────

describe('SaveManager — load() — malformed format', () => {
  it('returns null for an empty string', async () => {
    expect(await manager.load('')).toBeNull();
  });

  it('logs error for a segment with no type tag', async () => {
    await manager.load('@@@');
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Malformed segment (no type tag):',
      expect.anything()
    );
  });

  it('returns null for a string with no type tag', async () => {
    expect(await manager.load('notTagged')).toBeNull();
  });
});

// ── load() — Base64 decode failure ─────────────────────────────────────────────

describe('SaveManager — load() — Base64 decode failure', () => {
  it('returns null for a segment with invalid Base64 blob', async () => {
    expect(await manager.load(taggedSegment('sceneConstants', '!!!not-base64!!!'))).toBeNull();
  });

  it('logs error for a segment with invalid Base64 blob', async () => {
    await manager.load(taggedSegment('sceneConstants', '!!!not-base64!!!'));
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decode base64 string:',
      expect.anything()
    );
  });

  it('returns null for a segment with whitespace-only blob', async () => {
    expect(await manager.load(taggedSegment('sceneConstants', '   '))).toBeNull();
  });
});

// ── load() — decompression failure ─────────────────────────────────────────────

describe('SaveManager — load() — decompression failure', () => {
  it('returns null for valid Base64 that is not deflate-compressed', async () => {
    const notCompressed = btoa('hello world not deflate compressed data');
    expect(await manager.load(taggedSegment('sceneConstants', notCompressed))).toBeNull();
  });

  it('logs error for valid Base64 that is not deflate-compressed', async () => {
    const notCompressed = btoa('hello world not deflate compressed data');
    await manager.load(taggedSegment('sceneConstants', notCompressed));
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to decompress data:',
      expect.anything()
    );
  });

  it('returns null for a truncated compressed stream', async () => {
    const fullSave = await manager.save(VALID_SEGMENTS);
    const firstBlobStart = fullSave.indexOf(':') + 1;
    const firstBlobEnd   = fullSave.indexOf('|||');
    const blob = fullSave.slice(firstBlobStart, firstBlobEnd === -1 ? undefined : firstBlobEnd);
    const truncated = await truncateBlob(blob);
    expect(await manager.load(taggedSegment('sceneConstants', truncated))).toBeNull();
  });
});

// ── load() — JSON parse failure ─────────────────────────────────────────────────

describe('SaveManager — load() — JSON parse failure', () => {
  it('returns null for valid compressed data that is not JSON', async () => {
    expect(await manager.load(taggedSegment('sceneConstants', await encodeRaw('not { json at all }}}')))).toBeNull();
  });

  it('logs error for valid compressed data that is not JSON', async () => {
    await manager.load(taggedSegment('sceneConstants', await encodeRaw('not { json at all }}}')));
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Failed to parse JSON:',
      expect.anything()
    );
  });
});

// ── load() — schema validation: sceneConstants ────────────────────────────────

describe('SaveManager — load() — schema validation: sceneConstants', () => {
  async function loadSceneConstants(payload: unknown) {
    return manager.load(taggedSegment('sceneConstants', await encodeRaw(JSON.stringify(payload))));
  }

  it('returns null when root is null', async () => {
    expect(await manager.load(taggedSegment('sceneConstants', await encodeRaw('null')))).toBeNull();
  });

  it('returns null when version field is missing', async () => {
    expect(await loadSceneConstants({ camera: CAMERA_FIXTURE })).toBeNull();
  });

  it('returns null when version is 0', async () => {
    expect(await loadSceneConstants({ version: 0, camera: CAMERA_FIXTURE })).toBeNull();
  });

  it('returns null when version is 2', async () => {
    expect(await loadSceneConstants({ version: 2, camera: CAMERA_FIXTURE })).toBeNull();
  });

  it('returns null when camera field is missing', async () => {
    expect(await loadSceneConstants({ version: 1 })).toBeNull();
  });

  it('returns null when camera is null', async () => {
    expect(await loadSceneConstants({ version: 1, camera: null })).toBeNull();
  });

  it('returns null when camera.position is missing', async () => {
    expect(await loadSceneConstants({ version: 1, camera: { yaw: 0, pitch: 0 } })).toBeNull();
  });

  it('returns null when camera.position is a string instead of an array', async () => {
    expect(await loadSceneConstants({ version: 1, camera: { position: '0,0,0', yaw: 0, pitch: 0 } })).toBeNull();
  });

  it('logs error with "Invalid sceneConstants segment" for violations', async () => {
    await manager.load(taggedSegment('sceneConstants', await encodeRaw('null')));
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Invalid sceneConstants segment:',
      expect.anything()
    );
  });
});

// ── load() — schema validation: gameObjects ───────────────────────────────────

describe('SaveManager — load() — schema validation: gameObjects', () => {
  async function loadGameObjects(payload: unknown) {
    return manager.load(taggedSegment('gameObjects', await encodeRaw(JSON.stringify(payload))));
  }

  it('returns null when objects field is missing', async () => {
    expect(await loadGameObjects({ version: 1 })).toBeNull();
  });

  it('returns null when objects[0].key is an unknown value', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'Sphere', label: 'x', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when objects[0].key is a light key (wrong segment)', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'Light', label: 'x', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when objects[0].label is missing', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'Cube', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when objects[0].position is missing', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'Cube', label: 'x', quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when FBX object has no assetUrl', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when FBX assetUrl is a number', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [], assetUrl: 123 }],
    })).toBeNull();
  });

  it('accepts a valid FBX assetUrl string', async () => {
    expect(await loadGameObjects({
      version: 1,
      objects: [{ key: 'FBX', label: 'model', position: [], quaternion: [], assetUrl: 'model.fbx' }],
    })).not.toBeNull();
  });

  it('logs error with "Invalid gameObjects segment" for violations', async () => {
    await loadGameObjects({ version: 1, objects: [{ key: 'Unknown' }] });
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Invalid gameObjects segment:',
      expect.anything()
    );
  });
});

// ── load() — schema validation: lightObjects ──────────────────────────────────

describe('SaveManager — load() — schema validation: lightObjects', () => {
  async function loadLightObjects(payload: unknown) {
    return manager.load(taggedSegment('lightObjects', await encodeRaw(JSON.stringify(payload))));
  }

  it('returns null when objects[0].key is an unknown value', async () => {
    expect(await loadLightObjects({
      version: 1,
      objects: [{ key: 'Sphere', label: 'x', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('returns null when objects[0].key is a game object key (wrong segment)', async () => {
    expect(await loadLightObjects({
      version: 1,
      objects: [{ key: 'Cube', label: 'x', position: [], quaternion: [] }],
    })).toBeNull();
  });

  it('logs error with "Invalid lightObjects segment" for violations', async () => {
    await loadLightObjects({ version: 1, objects: [{ key: 'Unknown' }] });
    expect(logger.error).toHaveBeenCalledWith(
      '[SaveManager] Invalid lightObjects segment:',
      expect.anything()
    );
  });
});

// ── load() — all valid object keys accepted ────────────────────────────────────

describe('SaveManager — load() — valid object keys', () => {
  it('accepts key "Cube" in gameObjects segment', async () => {
    const blob = await encodeRaw(JSON.stringify({ version: 1, objects: [CUBE_OBJECT] }));
    expect(await manager.load(taggedSegment('gameObjects', blob))).not.toBeNull();
  });

  it('accepts key "Quad" in gameObjects segment', async () => {
    const blob = await encodeRaw(JSON.stringify({ version: 1, objects: [QUAD_OBJECT] }));
    expect(await manager.load(taggedSegment('gameObjects', blob))).not.toBeNull();
  });

  it('accepts key "FBX" in gameObjects segment', async () => {
    const blob = await encodeRaw(JSON.stringify({ version: 1, objects: [FBX_OBJECT] }));
    expect(await manager.load(taggedSegment('gameObjects', blob))).not.toBeNull();
  });

  it('accepts key "Light" in lightObjects segment', async () => {
    const blob = await encodeRaw(JSON.stringify({ version: 1, objects: [LIGHT_OBJECT] }));
    expect(await manager.load(taggedSegment('lightObjects', blob))).not.toBeNull();
  });

  it('accepts key "DirectionalLight" in lightObjects segment', async () => {
    const blob = await encodeRaw(JSON.stringify({ version: 1, objects: [DIRECTIONAL_LIGHT_OBJECT] }));
    expect(await manager.load(taggedSegment('lightObjects', blob))).not.toBeNull();
  });
});

// ── load() — forward compatibility: unknown tags ignored ──────────────────────

describe('SaveManager — load() — unknown tags', () => {
  it('silently ignores unknown segment type and still loads known segments', async () => {
    const knownBlob = await encodeRaw(JSON.stringify({ version: 1, camera: CAMERA_FIXTURE }));
    const combined  = `futureType:someBlob|||sceneConstants:${knownBlob}`;
    const result    = await manager.load(combined);
    expect(result).not.toBeNull();
    expect(result?.sceneConstants[0].camera).toEqual(CAMERA_FIXTURE);
  });
});
