import { logger } from '../utils/logger';
import type {
  SaveSegments,
  SceneConstantsSnapshot,
  GameObjectsSnapshot,
  LightObjectsSnapshot,
  SkyboxSnapshot,
  InfiniteGroundSnapshot,
} from './types';

const MAX_ENCODED_BYTES = 5_000_000;
const SEGMENT_SEPARATOR = '|||';

const SEGMENT_TYPES = {
  sceneConstants:   'sceneConstants',
  gameObjects:      'gameObjects',
  lightObjects:     'lightObjects',
  skyboxObjects:    'skyboxObjects',
  infiniteGrounds:  'infiniteGrounds',
} as const;

type SegmentType = typeof SEGMENT_TYPES[keyof typeof SEGMENT_TYPES]

/**
 * Serializes and deserializes a scene to/from a single compressed base64 string.
 *
 * Pipeline per segment: JSON → UTF-8 bytes → deflate → base64.
 * All segments are joined with `|||`. Multiple segments of the same type are allowed.
 */
export class SaveManager {

  /**
   * Encodes all scene segments into a single `|||`-separated compressed base64 string.
   * Logs a warning (but still returns the string) if the result exceeds `MAX_ENCODED_BYTES`.
   *
   * @param segments - Scene data to serialize.
   * @returns Combined encoded string suitable for storage or clipboard.
   */
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
    for (const snapshot of segments.skyboxObjects ?? []) {
      pieces.push(`${SEGMENT_TYPES.skyboxObjects}:${await this._encode(snapshot)}`);
    }
    for (const snapshot of segments.infiniteGrounds ?? []) {
      pieces.push(`${SEGMENT_TYPES.infiniteGrounds}:${await this._encode(snapshot)}`);
    }

    const combinedString = pieces.join(SEGMENT_SEPARATOR);
    if (combinedString.length > MAX_ENCODED_BYTES) {
      logger.error('[SaveManager] Encoded scene exceeds size limit of', MAX_ENCODED_BYTES, '— actual size:', combinedString.length, 'bytes');
    } else {
      logger.info('[SaveManager] Scene saved, encoded length:', combinedString.length);
    }
    return combinedString;
  }

  /**
   * Decodes and validates a string previously produced by {@link SaveManager.save}.
   * Returns `null` on any malformed segment, base64 decode failure, decompression error,
   * JSON parse error, or schema violation. Unknown segment tags are silently skipped
   * for forward compatibility.
   *
   * @param combinedString - A `|||`-separated compressed base64 string.
   * @returns Parsed and validated scene segments, or `null` on any error.
   */
  async load(combinedString: string): Promise<SaveSegments | null> {
    const result: SaveSegments = {
      sceneConstants:   [],
      gameObjects:      [],
      lightObjects:     [],
      skyboxObjects:    [],
      infiniteGrounds:  [],
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
        || tag === SEGMENT_TYPES.lightObjects
        || tag === SEGMENT_TYPES.skyboxObjects
        || tag === SEGMENT_TYPES.infiniteGrounds;
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
      } else if (tag === SEGMENT_TYPES.skyboxObjects) {
        result.skyboxObjects!.push(decoded as SkyboxSnapshot);
      } else if (tag === SEGMENT_TYPES.infiniteGrounds) {
        result.infiniteGrounds!.push(decoded as InfiniteGroundSnapshot);
      }
      // Unknown tags are silently ignored for forward compatibility
    }

    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  /** JSON → UTF-8 → deflate (CompressionStream) → base64 (btoa). */
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

  /**
   * base64 → raw bytes → inflate (DecompressionStream) → JSON parse.
   * Returns `{ ok: false }` on any step failure; errors are logged but not re-thrown.
   */
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

/** Returns null on success, or a string describing the first schema violation. */
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

/** Returns null on success, or a string describing the first schema violation. */
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
