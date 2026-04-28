import type { ModelAssetHandle, FbxAssetHandle } from '../types';
import type { ParsedFbxData } from '../loaders/parseFbx';
import { ModelAsset } from '../gameObject/3D/renderables/ModelAsset';
import { FbxAsset } from '../gameObject/3D/renderables/FbxAsset';
import { parseObj } from '../loaders/parseObj';
import { parseFbx } from '../loaders/parseFbx';
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
 * @internal
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

// ── External texture helpers ──────────────────────────────────────────────────

async function fetchExternalTexture(
  texturePath: string,
  baseUrl: string,
  overrides: Record<string, string>,
): Promise<ImageBitmap | null> {
  const normalised = texturePath.replace(/\\/g, '/');
  const filename   = normalised.split('/').pop() ?? normalised;
  let resolved: string;
  if (overrides[filename]) {
    resolved = overrides[filename];
  } else {
    try { resolved = new URL(normalised, baseUrl).href; }
    catch { return null; }
  }
  try {
    const response = await fetch(resolved);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch { return null; }
}

async function resolveExternalTextures(
  parsed: ParsedFbxData,
  baseUrl: string,
  overrides: Record<string, string>,
): Promise<void> {
  await Promise.all(parsed.meshes.map(async (mesh) => {
    const mat = mesh.material;
    if (!mat.diffuseImageData && mat.diffuseTexturePath) {
      mat.diffuseImageData = await fetchExternalTexture(mat.diffuseTexturePath, baseUrl, overrides);
    }
    if (!mat.normalMapImageData && mat.normalMapTexturePath) {
      mat.normalMapImageData = await fetchExternalTexture(mat.normalMapTexturePath, baseUrl, overrides);
    }
    // Fallback: FBX has no embedded texture paths — try mat.name + ".png" in overrides.
    // Applies to Blender-exported FBX where textures are external and not referenced by path.
    if (!mat.diffuseImageData && !mat.diffuseTexturePath && mat.name && mat.name !== 'default' && mat.name !== 'material') {
      mat.diffuseImageData = await fetchExternalTexture(`${mat.name}.png`, baseUrl, overrides);
    }
  }));
}

// ── Loaders ───────────────────────────────────────────────────────────────────

/**
 * Fetches and parses a .fbx file, uploading all mesh geometry and textures to GPU once.
 * The returned handle can be passed to Engine.createFbxModel() many times.
 * Pass textureOverrides (filename → URL) to resolve external textures that are not embedded
 * in the FBX — Vite glob imports are the recommended source for these URLs.
 * @internal
 */
export async function loadFbxAsset(
  device: GPUDevice,
  queue: GPUQueue,
  fbxMaterialLayout: GPUBindGroupLayout,
  url: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  textureOverrides: Record<string, string> = {},
): Promise<FbxAssetHandle> {
  const bytes  = await fetchWithLimit(url, 'loadFbxAsset', timeoutMs);
  const parsed = await parseFbx(bytes, url.split('/').pop() ?? '');
  await resolveExternalTextures(parsed, url, textureOverrides);
  return new FbxAsset(device, queue, fbxMaterialLayout, parsed);
}
