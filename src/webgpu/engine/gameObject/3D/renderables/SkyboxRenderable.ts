import type { Renderable, RenderableInitArgs } from './Renderable';
import type { Camera } from '../../../core/Camera';
import type { UniformPool, UniformSlot } from '../../../buffers/UniformPool';
import { COMMON } from '../../../shaders/common';
import { SKYBOX } from '../../../shaders/skybox';
import type { Vec3, Vec4 } from '../../../math/vec';

const SKYBOX_PIPELINE_KEY = 'skybox';

/**
 * Fullscreen solid-color background fill.
 * Renders via 6 procedural vertices (no vertex buffer).
 * Pipeline uses depthCompare:'always' + depthWriteEnabled:false so all
 * world geometry draws on top regardless of depth.
 * @internal
 */
export class SkyboxRenderable implements Renderable {
  readonly id = Symbol();
  readonly layer = 'world' as const;
  readonly pipelineKey = SKYBOX_PIPELINE_KEY;
  visible = true;

  private _uniformSlot!: UniformSlot;
  private _uniformPool!: UniformPool;
  private _objectBindGroup!: GPUBindGroup;
  private _pipeline!: GPURenderPipeline;
  private _device!: GPUDevice;
  // 16 floats: model mat4 (identity, unused) + 4 floats tint
  private _uniformData = new Float32Array(20);

  constructor(color: [number, number, number, number] = [0.1, 0.12, 0.15, 1]) {
    // Identity matrix
    this._uniformData[0]  = 1; this._uniformData[5]  = 1;
    this._uniformData[10] = 1; this._uniformData[15] = 1;
    this._uniformData.set(color, 16);
  }

  init(args: RenderableInitArgs): void {
    const { device, format, pipelineCache, layouts, uniformPool } = args;
    this._device = device;
    this._uniformPool = uniformPool;

    // ── Object uniform ───────────────────────────────────────────────────────
    this._uniformSlot = uniformPool.allocate(80);
    uniformPool.write(this._uniformSlot, this._uniformData);

    this._objectBindGroup = device.createBindGroup({
      label: 'skybox:obj',
      layout: layouts.object,
      entries: [{
        binding: 0,
        resource: {
          buffer: this._uniformSlot.buffer,
          offset: this._uniformSlot.offset,
          size: 80,
        },
      }],
    });

    // ── Render pipeline ──────────────────────────────────────────────────────
    const shaderSrc = COMMON + '\n' + SKYBOX;
    const shaderModule = device.createShaderModule({ label: 'skybox-shader', code: shaderSrc });

    this._pipeline = pipelineCache.getOrCreateRender(SKYBOX_PIPELINE_KEY, {
      label: 'skybox-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [layouts.camera, layouts.object, layouts.empty, layouts.lights],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [],  // procedural — no vertex buffer
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'always',
      },
    });
  }

  encode(pass: GPURenderPassEncoder, _camera: Camera): void {
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(1, this._objectBindGroup);
    pass.draw(6);
  }

  get color(): [number, number, number, number] {
    return [
      this._uniformData[16],
      this._uniformData[17],
      this._uniformData[18],
      this._uniformData[19],
    ];
  }

  setColor(r: number, g: number, b: number, a: number): void {
    this._uniformData[16] = r;
    this._uniformData[17] = g;
    this._uniformData[18] = b;
    this._uniformData[19] = a;
    this._device.queue.writeBuffer(
      this._uniformSlot.buffer, this._uniformSlot.offset, this._uniformData
    );
  }

  // ── Renderable interface stubs (transform irrelevant for fullscreen quad) ──

  setPosition(_position: Vec3): void {}
  setQuaternion(_quaternion: Vec4): void {}
  setScale(_x: number, _y: number, _z: number): void {}

  clone(): SkyboxRenderable {
    return new SkyboxRenderable([...this.color]);
  }

  destroy(): void {
    this._uniformPool.free(this._uniformSlot);
  }
}
