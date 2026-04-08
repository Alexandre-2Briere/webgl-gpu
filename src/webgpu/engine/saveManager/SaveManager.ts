import { logger } from '../utils/logger'
import type { SceneSnapshot } from './types'

const MAX_ENCODED_BYTES = 5_000_000

export class SaveManager {

  async save(snapshot: SceneSnapshot): Promise<string> {
    const jsonString = JSON.stringify(snapshot)
    const encodedBytes = new TextEncoder().encode(jsonString)
    const compressionStream = new CompressionStream('deflate')
    const compressionWriter = compressionStream.writable.getWriter()
    compressionWriter.write(encodedBytes)
    compressionWriter.close()
    const compressedBuffer = await new Response(compressionStream.readable).arrayBuffer()
    const compressedBytes = new Uint8Array(compressedBuffer)
    const base64String = btoa(String.fromCharCode(...compressedBytes))
    if (base64String.length > MAX_ENCODED_BYTES) {
      logger.error('[SaveManager] Encoded scene exceeds size limit of', MAX_ENCODED_BYTES, '— actual size:', base64String.length, 'bytes')
    } else {
      logger.info('[SaveManager] Scene saved, encoded length:', base64String.length)
    }
    return base64String
  }

  async load(encodedString: string): Promise<SceneSnapshot | null> {
    let binaryString: string
    try {
      binaryString = atob(encodedString)
    } catch (base64Error) {
      logger.error('[SaveManager] Failed to decode base64 string:', base64Error)
      return null
    }

    let jsonString: string
    try {
      const rawBytes = Uint8Array.from(binaryString, char => char.charCodeAt(0))
      const decompressionStream = new DecompressionStream('deflate')
      const decompressionWriter = decompressionStream.writable.getWriter()
      decompressionWriter.write(rawBytes).catch(() => {})
      decompressionWriter.close().catch(() => {})
      jsonString = await new Response(decompressionStream.readable).text()
    } catch (decompressionError) {
      logger.error('[SaveManager] Failed to decompress data:', decompressionError)
      return null
    }

    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonString)
    } catch (jsonError) {
      logger.error('[SaveManager] Failed to parse JSON:', jsonError)
      return null
    }

    const validationError = _validateSnapshot(parsedData)
    if (validationError !== null) {
      logger.error('[SaveManager] Invalid snapshot schema:', validationError)
      return null
    }

    return parsedData as SceneSnapshot
  }
}

const VALID_OBJECT_KEYS = new Set(['Cube', 'Quad', 'FBX', 'Light', 'DirectionalLight'])

/** Returns null on success, or a string describing the first schema violation. */
function _validateSnapshot(parsedData: unknown): string | null {
  if (typeof parsedData !== 'object' || parsedData === null) {
    return 'root is not an object'
  }
  const snapshot = parsedData as Record<string, unknown>
  if (snapshot['version'] !== 1) {
    return `unsupported version: ${String(snapshot['version'])}`
  }
  const cameraData = snapshot['camera']
  if (typeof cameraData !== 'object' || cameraData === null) {
    return 'camera is missing or not an object'
  }
  if (!Array.isArray((cameraData as Record<string, unknown>)['position'])) {
    return 'camera.position is not an array'
  }
  if (!Array.isArray(snapshot['objects'])) {
    return 'objects is not an array'
  }
  for (let objectIndex = 0; objectIndex < (snapshot['objects'] as unknown[]).length; objectIndex++) {
    const objectEntry = (snapshot['objects'] as unknown[])[objectIndex]
    if (typeof objectEntry !== 'object' || objectEntry === null) {
      return `objects[${objectIndex}] is not an object`
    }
    const objectRecord = objectEntry as Record<string, unknown>
    if (!VALID_OBJECT_KEYS.has(objectRecord['key'] as string)) {
      return `objects[${objectIndex}].key is invalid: "${String(objectRecord['key'])}"`
    }
    if (typeof objectRecord['label'] !== 'string') {
      return `objects[${objectIndex}].label is not a string`
    }
    if (!Array.isArray(objectRecord['position'])) {
      return `objects[${objectIndex}].position is not an array`
    }
    if (!Array.isArray(objectRecord['quaternion'])) {
      return `objects[${objectIndex}].quaternion is not an array`
    }
    if (objectRecord['key'] === 'FBX' && typeof objectRecord['assetUrl'] !== 'string') {
      return `objects[${objectIndex}] is FBX but assetUrl is not a string`
    }
  }
  return null
}
