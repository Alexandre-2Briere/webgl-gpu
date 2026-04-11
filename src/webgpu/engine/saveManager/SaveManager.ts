import { logger } from '../utils/logger';
import type {
  SaveSegments,
  SceneConstantsSnapshot,
  GameObjectsSnapshot,
  LightObjectsSnapshot,
} from './types';

const MAX_ENCODED_BYTES = 5_000_000;
const SEGMENT_SEPARATOR = '|||';

const SEGMENT_TYPES = {
  sceneConstants: 'sceneConstants',
  gameObjects:    'gameObjects',
  lightObjects:   'lightObjects',
} as const;

type SegmentType = typeof SEGMENT_TYPES[keyof typeof SEGMENT_TYPES]

export class SaveManager {

  async save(segments: SaveSegments): Promise<string> {
    const pieces: string[] = [];

    for (const snapshot of segments.sceneConstants) {
      pieces.push(`${SEGMENT_TYPES.sceneConstants}:${await this._encode(snapshot)}`);
    }
    for (const snapshot of segments.gameObjects) {
      pieces.push(`${SEGMENT_TYPES.gameObjects}:${await this._encode(snapshot)}`);
    }
    for (const snapshot of segments.lightObjects) {
      pieces.push(`${SEGMENT_TYPES.lightObjects}:${await this._encode(snapshot)}`);
    }

    const combinedString = pieces.join(SEGMENT_SEPARATOR);
    if (combinedString.length > MAX_ENCODED_BYTES) {
      logger.error('[SaveManager] Encoded scene exceeds size limit of', MAX_ENCODED_BYTES, '— actual size:', combinedString.length, 'bytes');
    } else {
      logger.info('[SaveManager] Scene saved, encoded length:', combinedString.length);
    }
    return combinedString;
  }

  async load(combinedString: string): Promise<SaveSegments | null> {
    const result: SaveSegments = {
      sceneConstants: [],
      gameObjects:    [],
      lightObjects:   [],
    };

    const pieces = combinedString.split(SEGMENT_SEPARATOR);
    for (const piece of pieces) {
      const separatorIndex = piece.indexOf(':');
      if (separatorIndex === -1) {
        logger.error('[SaveManager] Malformed segment (no type tag):', piece.slice(0, 40));
        return null;
      }
      const tag  = piece.slice(0, separatorIndex) as SegmentType;
      const blob = piece.slice(separatorIndex + 1);

      // Skip unknown tags before attempting to decode
      const isKnownTag = tag === SEGMENT_TYPES.sceneConstants
        || tag === SEGMENT_TYPES.gameObjects
        || tag === SEGMENT_TYPES.lightObjects;
      if (!isKnownTag) continue;

      const decodeResult = await this._decode(blob);
      if (!decodeResult.ok) return null;
      const decoded = decodeResult.value;

      if (tag === SEGMENT_TYPES.sceneConstants) {
        const error = _validateSceneConstantsSnapshot(decoded);
        if (error !== null) {
          logger.error('[SaveManager] Invalid sceneConstants segment:', error);
          return null;
        }
        result.sceneConstants.push(decoded as SceneConstantsSnapshot);
      } else if (tag === SEGMENT_TYPES.gameObjects) {
        const error = _validateGameObjectsSnapshot(decoded);
        if (error !== null) {
          logger.error('[SaveManager] Invalid gameObjects segment:', error);
          return null;
        }
        result.gameObjects.push(decoded as GameObjectsSnapshot);
      } else if (tag === SEGMENT_TYPES.lightObjects) {
        const error = _validateLightObjectsSnapshot(decoded);
        if (error !== null) {
          logger.error('[SaveManager] Invalid lightObjects segment:', error);
          return null;
        }
        result.lightObjects.push(decoded as LightObjectsSnapshot);
      }
      // Unknown tags are silently ignored for forward compatibility
    }

    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  private async _encode(data: unknown): Promise<string> {
    const jsonString   = JSON.stringify(data);
    const encodedBytes = new TextEncoder().encode(jsonString);
    const compressionStream  = new CompressionStream('deflate');
    const compressionWriter  = compressionStream.writable.getWriter();
    compressionWriter.write(encodedBytes);
    compressionWriter.close();
    const compressedBuffer = await new Response(compressionStream.readable).arrayBuffer();
    const compressedBytes  = new Uint8Array(compressedBuffer);
    return btoa(String.fromCharCode(...compressedBytes));
  }

  private async _decode(encoded: string): Promise<{ ok: true; value: unknown } | { ok: false }> {
    let binaryString: string;
    try {
      binaryString = atob(encoded);
    } catch (base64Error) {
      logger.error('[SaveManager] Failed to decode base64 string:', base64Error);
      return { ok: false };
    }

    let jsonString: string;
    try {
      const rawBytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
      const decompressionStream = new DecompressionStream('deflate');
      const decompressionWriter = decompressionStream.writable.getWriter();
      decompressionWriter.write(rawBytes).catch(() => {});
      decompressionWriter.close().catch(() => {});
      jsonString = await new Response(decompressionStream.readable).text();
    } catch (decompressionError) {
      logger.error('[SaveManager] Failed to decompress data:', decompressionError);
      return { ok: false };
    }

    try {
      return { ok: true, value: JSON.parse(jsonString) };
    } catch (jsonError) {
      logger.error('[SaveManager] Failed to parse JSON:', jsonError);
      return { ok: false };
    }
  }
}

// ── Validators ─────────────────────────────────────────────────────────────────

/** Returns null on success, or a string describing the first schema violation. */
function _validateSceneConstantsSnapshot(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'root is not an object';
  const snapshot = data as Record<string, unknown>;
  if (snapshot['version'] !== 1) return `unsupported version: ${String(snapshot['version'])}`;
  const cameraData = snapshot['camera'];
  if (typeof cameraData !== 'object' || cameraData === null) return 'camera is missing or not an object';
  if (!Array.isArray((cameraData as Record<string, unknown>)['position'])) return 'camera.position is not an array';
  return null;
}

const GAME_OBJECT_KEYS = new Set(['Cube', 'Quad', 'FBX']);

function _validateGameObjectsSnapshot(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'root is not an object';
  const snapshot = data as Record<string, unknown>;
  if (snapshot['version'] !== 1) return `unsupported version: ${String(snapshot['version'])}`;
  if (!Array.isArray(snapshot['objects'])) return 'objects is not an array';
  for (let index = 0; index < (snapshot['objects'] as unknown[]).length; index++) {
    const entry = (snapshot['objects'] as unknown[])[index];
    if (typeof entry !== 'object' || entry === null) return `objects[${index}] is not an object`;
    const record = entry as Record<string, unknown>;
    if (!GAME_OBJECT_KEYS.has(record['key'] as string)) return `objects[${index}].key is invalid: "${String(record['key'])}"`;
    if (typeof record['label'] !== 'string') return `objects[${index}].label is not a string`;
    if (!Array.isArray(record['position'])) return `objects[${index}].position is not an array`;
    if (!Array.isArray(record['quaternion'])) return `objects[${index}].quaternion is not an array`;
    if (record['key'] === 'FBX' && typeof record['assetUrl'] !== 'string') return `objects[${index}] is FBX but assetUrl is not a string`;
  }
  return null;
}

const LIGHT_OBJECT_KEYS = new Set(['Light', 'DirectionalLight']);

function _validateLightObjectsSnapshot(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'root is not an object';
  const snapshot = data as Record<string, unknown>;
  if (snapshot['version'] !== 1) return `unsupported version: ${String(snapshot['version'])}`;
  if (!Array.isArray(snapshot['objects'])) return 'objects is not an array';
  for (let index = 0; index < (snapshot['objects'] as unknown[]).length; index++) {
    const entry = (snapshot['objects'] as unknown[])[index];
    if (typeof entry !== 'object' || entry === null) return `objects[${index}] is not an object`;
    const record = entry as Record<string, unknown>;
    if (!LIGHT_OBJECT_KEYS.has(record['key'] as string)) return `objects[${index}].key is invalid: "${String(record['key'])}"`;
    if (typeof record['label'] !== 'string') return `objects[${index}].label is not a string`;
    if (!Array.isArray(record['position'])) return `objects[${index}].position is not an array`;
    if (!Array.isArray(record['quaternion'])) return `objects[${index}].quaternion is not an array`;
  }
  return null;
}
