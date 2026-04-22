import type { Renderable, RenderableInitArgs } from './Renderable';
import type { ArrowGizmoOptions } from '../../types';
import type { Camera } from '../../core/Camera';
import type { UniformPool, UniformSlot } from '../../buffers/UniformPool';
import { COMMON } from '../../shaders/common';
import { ARROW_GIZMO, ARROW_GIZMO_VISIBLE_KEY, ARROW_GIZMO_OCCLUDED_KEY } from '../../shaders/arrowGizmo';
import { makeTransformMatrix } from '../../math';
import type { Vec3, Vec4 } from '../../math';
import { logger } from '../../utils';

/** Total vertex count: 96 vertices per arrow × 3 arrows. */
const TOTAL_VERTEX_COUNT = 288;

const DEFAULT_COLOR_X: [number, number, number, number] = [1,    0.15, 0.15, 1];
const DEFAULT_COLOR_Y: [number, number, number, number] = [0.15, 1,    0.15, 1];
const DEFAULT_COLOR_Z: [number, number, number, number] = [0.15, 0.15, 1,    1];

/**
 * ArrowGizmo — world-space procedural axis arrows for editor use.
 *
 * Draws three arrows (red X, green Y, blue Z) at a world-space origin.
 * Per-axis visibility is toggled individually. Occluded portions render
 * at 75% opacity using a two-pipeline approach (depthCompare 'greater'
 * then 'less-equal'), neither pass writes to the depth buffer.
 *
 * No vertex buffer: all geometry is generated in the vertex shader from
 * @builtin(vertex_index). pass.draw(288) per sub-pass.
 */
export class ArrowGizmo implements Renderable {
  readonly id = Symbol();
  readonly layer = 'world-overlay';
  readonly pipelineKey = ARROW_GIZMO_VISIBLE_KEY;
  visible = false;

  private readonly _opts: ArrowGizmoOptions;

  // GPU resources — set during init()
  private _queue!:               GPUQueue;
  private _objectSlot!:          UniformSlot;
  private _uniformPool!:         UniformPool;
  private _objectBindGroup!:     GPUBindGroup;
  private _gizmoBuffer!:         GPUBuffer;
  private _gizmoBindGroup!:      GPUBindGroup;
  private _pipeline!:          GPURenderPipeline;
  private _occludedPipeline!:  GPURenderPipeline;
  private _initialized = false;

  // CPU-side uniform data
  private readonly _objectData  = new Float32Array(20);  // model mat (16) + tint (4)
  private readonly _gizmoData32 = new Float32Array(16);  // 64 bytes for GizmoUniforms
  private readonly _gizmoDataU32 = new Uint32Array(
    this._gizmoData32.buffer,
    this._gizmoData32.byteOffset,
    this._gizmoData32.length,
  );

  // Transform state
  private _position:       Vec3 = [0, 0, 0];
  private _quaternion:     Vec4 = [0, 0, 0, 1];
  private _scale:          Vec3 = [1, 1, 1];
  private _visibilityMask  = 0b111;  // all 3 axes visible

  constructor(opts: ArrowGizmoOptions = {}) {
    this._opts = opts;

    // Populate axis colors in _gizmoData32[0..11]
    const colorX = opts.colorX ?? DEFAULT_COLOR_X;
    const colorY = opts.colorY ?? DEFAULT_COLOR_Y;
    const colorZ = opts.colorZ ?? DEFAULT_COLOR_Z;
    this._gizmoData32.set(colorX, 0);
    this._gizmoData32.set(colorY, 4);
    this._gizmoData32.set(colorZ, 8);

    // visibilityMask at index 12, occludeAlpha at index 13
    this._gizmoDataU32[12] = this._visibilityMask;
    this._gizmoData32[13]  = 1.0;

    // Build identity model matrix into _objectData
    makeTransformMatrix(this._position, this._quaternion, this._scale, this._objectData);
  }

  // ── Renderable lifecycle ────────────────────────────────────────────────────

  init(args: RenderableInitArgs): void {
    if (this._initialized) {
      logger.error('ArrowGizmo: init() called more than once — ignoring');
      return;
    }
    this._initialized = true;

    const { device, queue, format, pipelineCache, layouts, uniformPool } = args;
    this._queue = queue;
    this._uniformPool = uniformPool;

    // ── Object uniform (group 1) ─────────────────────────────────────────────
    this._objectSlot = uniformPool.allocate(80);
    uniformPool.write(this._objectSlot, this._objectData);

    this._objectBindGroup = device.createBindGroup({
      label: this._opts.label ? `${this._opts.label}:obj` : 'arrow-gizmo:obj',
      layout: layouts.object,
      entries: [{
        binding: 0,
        resource: {
          buffer: this._objectSlot.buffer,
          offset: this._objectSlot.offset,
          size: 80,
        },
      }],
    });

    // ── Gizmo uniform buffer (group 2) ───────────────────────────────────────
    this._gizmoBuffer = device.createBuffer({
      label: this._opts.label ? `${this._opts.label}:gizmo` : 'arrow-gizmo:gizmo',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._gizmoBuffer, 0, this._gizmoData32);

    this._gizmoBindGroup = device.createBindGroup({
      label: this._opts.label ? `${this._opts.label}:gizmo-bg` : 'arrow-gizmo:gizmo-bg',
      layout: layouts.gizmo,
      entries: [{
        binding: 0,
        resource: { buffer: this._gizmoBuffer, offset: 0, size: 64 },
      }],
    });

    // ── Shader ───────────────────────────────────────────────────────────────
    const shaderSrc    = COMMON + '\n' + ARROW_GIZMO;
    const shaderModule = device.createShaderModule({
      label: 'arrow-gizmo-shader',
      code:  shaderSrc,
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [layouts.camera, layouts.object, layouts.gizmo, layouts.lights],
    });

    const sharedConfig = {
      layout: pipelineLayout,
      vertex: {
        module:     shaderModule,
        entryPoint: 'vs',
        buffers:    [] as GPUVertexBufferLayout[],
      },
      fragment: {
        module:     shaderModule,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha' as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
            alpha: { srcFactor: 'one'       as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
          },
        }],
      },
      primitive: { topology: 'triangle-list' as GPUPrimitiveTopology, frontFace: 'ccw' as GPUFrontFace, cullMode: 'back' as GPUCullMode },
    };

    // ── Visible pipeline (draws on top of or co-planar with scene geometry) ────
    this._pipeline = pipelineCache.getOrCreateRender(this.pipelineKey, {
      label: 'arrow-gizmo-visible-pipeline',
      ...sharedConfig,
      depthStencil: {
        format:            'depth24plus',
        depthWriteEnabled: false,
        depthCompare:      'less-equal',
      },
    });

    // ── Occluded pipeline (ghosted arrows behind occluding geometry) ──────────
    this._occludedPipeline = pipelineCache.getOrCreateRender(ARROW_GIZMO_OCCLUDED_KEY, {
      label: 'arrow-gizmo-occluded-pipeline',
      ...sharedConfig,
      depthStencil: {
        format:            'depth24plus',
        depthWriteEnabled: false,
        depthCompare:      'greater',
      },
    });
  }

  encode(pass: GPURenderPassEncoder, _camera: Camera): void {
    pass.setBindGroup(1, this._objectBindGroup);
    pass.setBindGroup(2, this._gizmoBindGroup);
    this._queue.writeBuffer(this._gizmoBuffer, 0, this._gizmoData32);

    // Occluded sub-pass: ghosted arrows drawn through occluding geometry.
    pass.setPipeline(this._occludedPipeline);
    pass.draw(TOTAL_VERTEX_COUNT);

    // Visible sub-pass: solid arrows drawn on top of or co-planar with geometry.
    pass.setPipeline(this._pipeline);
    pass.draw(TOTAL_VERTEX_COUNT);
  }

  // ── Transform ───────────────────────────────────────────────────────────────

  get position(): [number, number, number] {
    return [this._position[0], this._position[1], this._position[2]];
  }

  setPosition(position: Vec3): void {
    this._position = [...position];
    this._rebuildMatrix();
  }

  setQuaternion(quaternion: Vec4): void {
    this._quaternion = [...quaternion];
    this._rebuildMatrix();
  }

  setScale(x: number, y: number, z: number): void {
    this._scale = [x, y, z];
    this._rebuildMatrix();
  }

  private _rebuildMatrix(): void {
    makeTransformMatrix(this._position, this._quaternion, this._scale, this._objectData);
    this._queue.writeBuffer(
      this._objectSlot.buffer, this._objectSlot.offset, this._objectData,
    );
  }

  // ── Axis visibility ──────────────────────────────────────────────────────────

  /** Show or hide an individual axis arrow. axis: 0=X, 1=Y, 2=Z */
  setAxisVisible(axis: 0 | 1 | 2, visible: boolean): void {
    if (visible) {
      this._visibilityMask |= (1 << axis);
    } else {
      this._visibilityMask &= ~(1 << axis);
    }
    this._gizmoDataU32[12] = this._visibilityMask;
    this._queue.writeBuffer(this._gizmoBuffer, 0, this._gizmoData32);
  }

  // ── Renderable interface (color / clone / destroy) ───────────────────────────

  get color(): [number, number, number, number] {
    return [this._gizmoData32[0], this._gizmoData32[1], this._gizmoData32[2], this._gizmoData32[3]];
  }

  setColor(_r: number, _g: number, _b: number, _a: number): void {
    logger.error('ArrowGizmo: setColor() is not supported — set axis colors via ArrowGizmoOptions at construction');
  }

  clone(): ArrowGizmo {
    logger.error('ArrowGizmo: clone() is not supported — gizmo is a singleton editor tool');
    return this;
  }

  destroy(): void {
    this._uniformPool.free(this._objectSlot);
    this._gizmoBuffer.destroy();
  }
}
