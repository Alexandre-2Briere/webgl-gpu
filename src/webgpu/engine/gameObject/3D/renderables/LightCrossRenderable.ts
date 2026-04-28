import type { Renderable, RenderableInitArgs } from './Renderable';
import type { Camera } from '../../../core/Camera';
import type { UniformPool, UniformSlot } from '../../../buffers/UniformPool';
import type { Vec3, Vec4 } from '../../../math/vec';
import { COMMON } from '../../../shaders/common';
import { LIGHT, LIGHT_CROSS_PIPELINE_KEY } from '../../../shaders/light';
import { logger } from '../../../utils/logger';
import type { LightGameObject } from '../../Light/LightGameObject';

/** @internal */
export class LightCrossRenderable implements Renderable {
  readonly id          = Symbol();
  readonly layer       = 'overlay' as const;
  readonly pipelineKey = LIGHT_CROSS_PIPELINE_KEY;
  visible              = true;

  private readonly _light:            LightGameObject;
  private readonly _queue:            GPUQueue;
  private readonly _uniformSlot:      UniformSlot;
  private readonly _uniformPool:      UniformPool;
  private readonly _objectBindGroup:  GPUBindGroup;
  private readonly _pipeline:         GPURenderPipeline;
  private readonly _uniformData =     new Float32Array(20);  // 16 (model) + 4 (tint)

  constructor(light: LightGameObject, args: RenderableInitArgs) {
    this._light = light;
    this._queue = args.queue;
    this._uniformPool = args.uniformPool;

    // ── Object uniform ───────────────────────────────────────────────────────
    this._uniformSlot = args.uniformPool.allocate(80);
    args.uniformPool.write(this._uniformSlot, this._uniformData);

    this._objectBindGroup = args.device.createBindGroup({
      label: 'light-cross:obj',
      layout: args.layouts.object,
      entries: [{
        binding: 0,
        resource: {
          buffer: this._uniformSlot.buffer,
          offset: this._uniformSlot.offset,
          size:   80,
        },
      }],
    });

    // ── Render pipeline ──────────────────────────────────────────────────────
    const shaderSource = COMMON + '\n' + LIGHT;
    const shaderModule = args.device.createShaderModule({
      label: 'light-cross-shader',
      code:  shaderSource,
    });

    this._pipeline = args.pipelineCache.getOrCreateRender(LIGHT_CROSS_PIPELINE_KEY, {
      label: 'light-cross-pipeline',
      layout: args.device.createPipelineLayout({
        bindGroupLayouts: [args.layouts.camera, args.layouts.object],
      }),
      vertex: {
        module:     shaderModule,
        entryPoint: 'vs',
        buffers:    [],
      },
      fragment: {
        module:     shaderModule,
        entryPoint: 'fs',
        targets: [{
          format: args.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      // No depthStencil — overlay pass has no depth attachment
    });
  }

  encode(pass: GPURenderPassEncoder, camera: Camera): void {
    // Project light world position to NDC using the camera viewProj matrix.
    // camera.getData() returns a packed Float32Array where indices [0..15]
    // are the column-major viewProj mat4x4f.
    const viewProjection = camera.getData();
    const [worldX, worldY, worldZ] = this._light.position;

    const clipX = viewProjection[0]*worldX + viewProjection[4]*worldY + viewProjection[8]*worldZ  + viewProjection[12];
    const clipY = viewProjection[1]*worldX + viewProjection[5]*worldY + viewProjection[9]*worldZ  + viewProjection[13];
    const clipW = viewProjection[3]*worldX + viewProjection[7]*worldY + viewProjection[11]*worldZ + viewProjection[15];
    if (clipW <= 0) return;  // behind camera — skip draw

    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;

    // Cross size: baseline 0.02 NDC + 1% of radius per NDC unit
    const rawScale   = this._light.radius * 0.003 + 0.02;
    const crossScale = Math.min(rawScale, 0.12);

    // Pack center and scale into the model matrix uniform (column-major mat4x4f):
    //   model[0][0] = flat index  0 → x scale (column 0, row 0)
    //   model[1][1] = flat index  5 → y scale (column 1, row 1)
    //   model[3][0] = flat index 12 → NDC center x (translation column, row 0)
    //   model[3][1] = flat index 13 → NDC center y (translation column, row 1)
    // All other model indices stay 0 — the shader only reads these four.
    const [lightRed, lightGreen, lightBlue, lightAlpha] = this._light.color;
    this._uniformData[0]  = crossScale;
    this._uniformData[5]  = crossScale;
    this._uniformData[12] = ndcX;
    this._uniformData[13] = ndcY;
    this._uniformData[16] = lightRed;
    this._uniformData[17] = lightGreen;
    this._uniformData[18] = lightBlue;
    this._uniformData[19] = lightAlpha;
    this._queue.writeBuffer(this._uniformSlot.buffer, this._uniformSlot.offset, this._uniformData);

    pass.setPipeline(this._pipeline);
    pass.setBindGroup(1, this._objectBindGroup);
    pass.draw(6);
  }

  // ── Renderable interface — unsupported on LightCrossRenderable ───────────────

  init(_args: RenderableInitArgs): void {
    logger.error('LightCrossRenderable: init() must not be called — setup is done in the constructor');
  }

  get color(): [number, number, number, number] {
    return this._light.color;
  }

  setColor(_r: number, _g: number, _b: number, _a: number): void {
    logger.error('LightCrossRenderable: setColor() is not supported — color is driven by LightGameObject.color');
  }

  setPosition(_position: Vec3): void {
    logger.error('LightCrossRenderable: setPosition() is not supported — position is driven by LightGameObject.position');
  }

  setQuaternion(_quaternion: Vec4): void {
    logger.error('LightCrossRenderable: setQuaternion() is not supported — LightCrossRenderable has no orientation');
  }

  setScale(_x: number, _y: number, _z: number): void {
    logger.error('LightCrossRenderable: setScale() is not supported — scale is derived from LightGameObject.radius');
  }

  clone(): LightCrossRenderable {
    logger.error('LightCrossRenderable: clone() is not supported');
    return this;
  }

  destroy(): void {
    this._uniformPool.free(this._uniformSlot);
  }
}
