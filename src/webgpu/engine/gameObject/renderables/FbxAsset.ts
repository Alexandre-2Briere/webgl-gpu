import type { FbxAssetHandle } from '../../types';
import type { ParsedFbxData } from '../../loaders/parseFbx';

export interface FbxMeshSlice {
  vertexBuf: GPUBuffer
  indexBuf: GPUBuffer
  indexCount: number
  materialBindGroup: GPUBindGroup
}

/**
 * GPU-side asset produced by Engine.loadFbx().
 * Holds one FbxMeshSlice per mesh found in the FBX file, each with its own
 * vertex/index buffers and material bind group (diffuse + normal map textures).
 *
 * Safe to pass to createFbxModel() many times — slices are shared across instances.
 * Call destroy() only after all FbxModel instances using this asset have been destroyed.
 */
export class FbxAsset implements FbxAssetHandle {
  readonly slices: FbxMeshSlice[];
  get sliceCount(): number { return this.slices.length; }

  private readonly _device: GPUDevice;
  private readonly _queue: GPUQueue;
  private readonly _materialLayout: GPUBindGroupLayout;
  private readonly _sampler: GPUSampler;
  private readonly _fallbackDiffuse: GPUTexture;
  private readonly _fallbackNormal: GPUTexture;
  // null means the slice is using the shared fallback texture
  private readonly _sliceDiffuseTex: (GPUTexture | null)[];
  private readonly _sliceNormalTex: (GPUTexture | null)[];

  constructor(
    device: GPUDevice,
    queue: GPUQueue,
    fbxMaterialLayout: GPUBindGroupLayout,
    parsed: ParsedFbxData,
  ) {
    this._device = device;
    this._queue = queue;
    this._materialLayout = fbxMaterialLayout;

    this._sampler = device.createSampler({
      label: 'fbx-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    this._fallbackDiffuse = this._createFallbackTexture(device, queue, [255, 255, 255, 255]);
    this._fallbackNormal  = this._createFallbackTexture(device, queue, [128, 128, 255, 255]);

    this._sliceDiffuseTex = new Array(parsed.meshes.length).fill(null);
    this._sliceNormalTex  = new Array(parsed.meshes.length).fill(null);

    this.slices = parsed.meshes.map((mesh, index) => {
      const vertexBuf = device.createBuffer({
        label: `fbx:${mesh.name}:verts`,
        size: mesh.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      queue.writeBuffer(vertexBuf, 0, mesh.vertices as Float32Array<ArrayBuffer>);

      const indexBuf = device.createBuffer({
        label: `fbx:${mesh.name}:idx`,
        size: mesh.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      queue.writeBuffer(indexBuf, 0, mesh.indices as Uint32Array<ArrayBuffer>);

      let diffuseTex: GPUTexture;
      if (mesh.material.diffuseImageData) {
        diffuseTex = this._uploadImageBitmap(device, queue, mesh.material.diffuseImageData, `fbx:${mesh.name}:diffuse`);
        this._sliceDiffuseTex[index] = diffuseTex;
      } else if (mesh.material.baseColor) {
        diffuseTex = this._createFallbackTexture(device, queue, [
          Math.round(mesh.material.baseColor[0] * 255),
          Math.round(mesh.material.baseColor[1] * 255),
          Math.round(mesh.material.baseColor[2] * 255),
          255,
        ]);
        this._sliceDiffuseTex[index] = diffuseTex;
      } else {
        diffuseTex = this._fallbackDiffuse;
      }

      let normalTex: GPUTexture;
      if (mesh.material.normalMapImageData) {
        normalTex = this._uploadImageBitmap(device, queue, mesh.material.normalMapImageData, `fbx:${mesh.name}:normal`);
        this._sliceNormalTex[index] = normalTex;
      } else {
        normalTex = this._fallbackNormal;
      }

      const materialBindGroup = device.createBindGroup({
        label: `fbx:${mesh.name}:mat`,
        layout: fbxMaterialLayout,
        entries: [
          { binding: 0, resource: diffuseTex.createView() },
          { binding: 1, resource: normalTex.createView() },
          { binding: 2, resource: this._sampler },
        ],
      });

      return { vertexBuf, indexBuf, indexCount: mesh.indices.length, materialBindGroup };
    });
  }

  async setSliceTexture(sliceIndex: number, url: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const newTex = this._uploadImageBitmap(
      this._device, this._queue, bitmap, `fbx:slice${sliceIndex}:diffuse`,
    );
    bitmap.close();

    const oldTex = this._sliceDiffuseTex[sliceIndex];
    oldTex?.destroy();
    this._sliceDiffuseTex[sliceIndex] = newTex;

    const normalTex = this._sliceNormalTex[sliceIndex] ?? this._fallbackNormal;

    this.slices[sliceIndex].materialBindGroup = this._device.createBindGroup({
      label: `fbx:slice${sliceIndex}:mat`,
      layout: this._materialLayout,
      entries: [
        { binding: 0, resource: newTex.createView() },
        { binding: 1, resource: normalTex.createView() },
        { binding: 2, resource: this._sampler },
      ],
    });
  }

  destroy(): void {
    for (const slice of this.slices) {
      slice.vertexBuf.destroy();
      slice.indexBuf.destroy();
    }
    this._fallbackDiffuse.destroy();
    this._fallbackNormal.destroy();
    for (const tex of this._sliceDiffuseTex) tex?.destroy();
    for (const tex of this._sliceNormalTex) tex?.destroy();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _uploadImageBitmap(
    device: GPUDevice,
    queue: GPUQueue,
    bitmap: ImageBitmap,
    label: string,
  ): GPUTexture {
    const tex = device.createTexture({
      label,
      size: [bitmap.width, bitmap.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: tex },
      [bitmap.width, bitmap.height],
    );
    return tex;
  }

  private _createFallbackTexture(
    device: GPUDevice,
    queue: GPUQueue,
    rgba: [number, number, number, number],
  ): GPUTexture {
    const tex = device.createTexture({
      label: 'fbx-fallback',
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    queue.writeTexture({ texture: tex }, new Uint8Array(rgba), { bytesPerRow: 4 }, [1, 1, 1]);
    return tex;
  }
}
