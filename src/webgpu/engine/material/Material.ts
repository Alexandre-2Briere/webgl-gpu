/** GPU-owned Blinn-Phong material. Shareable across multiple GameObjects. */
export class Material {
  private _device!:          GPUDevice;
  private _queue!:           GPUQueue;
  private _layout!:          GPUBindGroupLayout;
  private _buffer!:          GPUBuffer;
  private _fallbackTexture!: GPUTexture;
  private _userTexture:      GPUTexture | null = null;
  private _sampler!:         GPUSampler;
  private _bindGroup!:       GPUBindGroup;

  private _shininess        = 32;
  private _specularStrength = 0.5;

  get bindGroup():        GPUBindGroup { return this._bindGroup; }
  get shininess():        number       { return this._shininess; }
  get specularStrength(): number       { return this._specularStrength; }

  /** @internal — called by Engine.createMaterial() */
  init(device: GPUDevice, queue: GPUQueue, layout: GPUBindGroupLayout): void {
    this._device = device;
    this._queue  = queue;
    this._layout = layout;

    // Uniform buffer: shininess (f32) + specularStrength (f32) + hasTexture (u32) + pad (f32) = 16 B
    this._buffer = device.createBuffer({
      label: 'material-uniform',
      size:  16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 1×1 white fallback texture
    this._fallbackTexture = device.createTexture({
      label:  'material-fallback-tex',
      size:   [1, 1, 1],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    queue.writeTexture(
      { texture: this._fallbackTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1, 1],
    );

    this._sampler = device.createSampler({
      label:        'material-sampler',
      magFilter:    'linear',
      minFilter:    'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    this._uploadUniforms();
    this._rebuildBindGroup();
  }

  setShininess(value: number): void {
    this._shininess = Math.max(0.001, value);
    this._uploadUniforms();
  }

  setSpecularStrength(value: number): void {
    this._specularStrength = Math.max(0, value);
    this._uploadUniforms();
  }

  async setTexture(path: string): Promise<void> {
    const response = await fetch(path);
    const blob     = await response.blob();
    const bitmap   = await createImageBitmap(blob);

    const texture = this._device.createTexture({
      label:  'material-tex',
      size:   [bitmap.width, bitmap.height, 1],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this._device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      [bitmap.width, bitmap.height],
    );
    bitmap.close();

    this._userTexture?.destroy();
    this._userTexture = texture;
    this._uploadUniforms();
    this._rebuildBindGroup();
  }

  destroy(): void {
    this._buffer.destroy();
    this._userTexture?.destroy();
    this._fallbackTexture.destroy();
  }

  private _rebuildBindGroup(): void {
    const textureView = (this._userTexture ?? this._fallbackTexture).createView();
    this._bindGroup = this._device.createBindGroup({
      label:   'material-bg',
      layout:  this._layout,
      entries: [
        { binding: 0, resource: { buffer: this._buffer } },
        { binding: 1, resource: textureView },
        { binding: 2, resource: this._sampler },
      ],
    });
  }

  private _uploadUniforms(): void {
    const data = new ArrayBuffer(16);
    const view = new DataView(data);
    view.setFloat32(0,  this._shininess,        true);
    view.setFloat32(4,  this._specularStrength,  true);
    view.setUint32( 8,  this._userTexture !== null ? 1 : 0, true);
    view.setFloat32(12, 0,                       true);
    this._queue.writeBuffer(this._buffer, 0, data);
  }
}
