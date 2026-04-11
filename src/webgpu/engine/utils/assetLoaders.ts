import type { ModelAssetHandle, FbxAssetHandle } from '../types';
import { ModelAsset } from '../gameObject/renderables/ModelAsset';
import { FbxAsset } from '../gameObject/renderables/FbxAsset';
import { parseObj, parseFbx } from '../loaders';
import { logger } from './logger';

/** Maximum asset download size (256 MB). Enforced on Content-Length and during streaming. */
const MAX_ASSET_BYTES = 256 * 1024 * 1024;

/** Default fetch timeout in milliseconds. Override per-call via the timeoutMs option. */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithLimit(url: string, label: string, timeoutMs: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${label}: failed to fetch "${url}" (${response.status})`);

    const contentLength = response.headers.get('Content-Length');
    if (contentLength !== null && Number(contentLength) > MAX_ASSET_BYTES)
      throw new Error(`${label}: asset too large (Content-Length ${contentLength} > ${MAX_ASSET_BYTES})`);

    if (!response.body) throw new Error(`${label}: response body is null`);

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ASSET_BYTES)
        throw new Error(`${label}: asset exceeded ${MAX_ASSET_BYTES} bytes during download`);
      chunks.push(value);
    }

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      logger.error(`${label}: download timed out after ${timeoutMs}ms — "${url}"`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches and parses a .obj file, uploading its geometry to GPU once.
 * The returned handle can be passed to Engine.createModel3D() many times.
 */
export async function loadObjAsset(
  device: GPUDevice,
  queue: GPUQueue,
  url: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelAssetHandle> {
  const bytes = await fetchWithLimit(url, 'loadObjAsset', timeoutMs);
  const text = new TextDecoder().decode(bytes);
  const { vertices, indices } = parseObj(text);
  return new ModelAsset(device, queue, vertices, indices);
}

/**
 * Fetches and parses a .fbx file, uploading all mesh geometry and textures to GPU once.
 * The returned handle can be passed to Engine.createFbxModel() many times.
 */
export async function loadFbxAsset(
  device: GPUDevice,
  queue: GPUQueue,
  fbxMaterialLayout: GPUBindGroupLayout,
  url: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<FbxAssetHandle> {
  const bytes = await fetchWithLimit(url, 'loadFbxAsset', timeoutMs);
  const parsed = await parseFbx(bytes);
  return new FbxAsset(device, queue, fbxMaterialLayout, parsed);
}
