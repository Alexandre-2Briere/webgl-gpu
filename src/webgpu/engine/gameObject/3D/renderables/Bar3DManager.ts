import type { Renderable, RenderableInitArgs } from './Renderable';
import type { Camera } from '../../../core/Camera';
import type { Vec3, Vec4 } from '../../../math/vec';
import type { Bar3DOptions } from '../../../types';
import { Bar3DHandle } from '../../UI/Bar3DHandle';
import { COMMON } from '../../../shaders/common';
import { BAR3D } from '../../../shaders/bar3d';

const INSTANCE_FLOATS    = 20;
const INSTANCE_BYTES     = 80;
const INITIAL_CAPACITY   = 64;
const BAR3D_PIPELINE_KEY = 'bar3d';

/** @internal — registered once per Engine, draws all Bar3DHandle instances in one call. */
export class Bar3DManager implements Renderable {
  readonly id          = Symbol();
  readonly layer       = 'world' as const;
  readonly pipelineKey = BAR3D_PIPELINE_KEY;
  visible              = true;

  private _device!:          GPUDevice;
  private _capacity          = INITIAL_CAPACITY;
  private _count             = 0;
  private _freeSlots:        number[] = [];
  private _data!:            Float32Array<ArrayBuffer>;
  private _instanceBuffer!:  GPUBuffer;
  private _instancesLayout!: GPUBindGroupLayout;
  private _instancesGroup!:  GPUBindGroup;
  private _emptyGroup1!:     GPUBindGroup;
  private _pipeline!:        GPURenderPipeline;

  init(args: RenderableInitArgs): void {
    const { device, format, pipelineCache, layouts } = args;
    this._device = device;
    this._data   = new Float32Array(this._capacity * INSTANCE_FLOATS) as Float32Array<ArrayBuffer>;

    this._instancesLayout = device.createBindGroupLayout({
      label:   'bar3d-instances-layout',
      entries: [{
        binding:    0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer:     { type: 'read-only-storage' },
      }],
    });

    this._instanceBuffer = device.createBuffer({
      label: 'bar3d-instances',
      size:  this._capacity * INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this._instancesGroup = device.createBindGroup({
      label:   'bar3d-instances-group',
      layout:  this._instancesLayout,
      entries: [{ binding: 0, resource: { buffer: this._instanceBuffer } }],
    });

    this._emptyGroup1 = device.createBindGroup({
      label:   'bar3d-empty-group1',
      layout:  layouts.empty,
      entries: [],
    });

    const shaderModule = device.createShaderModule({
      label: 'bar3d-shader',
      code:  COMMON + '\n' + BAR3D,
    });

    this._pipeline = pipelineCache.getOrCreateRender(BAR3D_PIPELINE_KEY, {
      label:  'bar3d-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [layouts.camera, layouts.empty, this._instancesLayout, layouts.lights],
      }),
      vertex: {
        module:     shaderModule,
        entryPoint: 'vs',
      },
      fragment: {
        module:     shaderModule,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive:    { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });
  }

  /**
   * Allocates a slot and writes per-instance data.
   *
   * Per-instance struct layout (80 bytes / 20 floats):
   *   [0..2]   position     vec3
   *   [3]      percentage   f32 (0–1)
   *   [4]      width        f32
   *   [5]      height       f32
   *   [6]      borderThickness f32
   *   [7]      visible      f32 (1=visible, 0=hidden)
   *   [8..11]  borderColor  vec4
   *   [12..15] fillColor    vec4
   *   [16..19] emptyColor   vec4
   */
  spawn(opts: Bar3DOptions): Bar3DHandle {
    let slot: number;
    if (this._freeSlots.length > 0) {
      slot = this._freeSlots.pop()!;
    } else {
      if (this._count >= this._capacity) this._grow();
      slot = this._count++;
    }

    const position = opts.position ?? [0, 0, 0];
    const base     = slot * INSTANCE_FLOATS;

    this._data[base + 0] = position[0];
    this._data[base + 1] = position[1];
    this._data[base + 2] = position[2];
    this._data[base + 3] = Math.max(0, Math.min(1, opts.percentage ?? 1));
    this._data[base + 4] = opts.width;
    this._data[base + 5] = opts.height;
    this._data[base + 6] = opts.borderThickness;
    this._data[base + 7] = 1;
    this._data.set(opts.borderColor,                base + 8);
    this._data.set(opts.fillColor,                  base + 12);
    this._data.set(opts.emptyColor ?? [0, 0, 0, 0], base + 16);

    this._writeSlot(slot);
    return new Bar3DHandle(this, slot, position as Vec3);
  }

  encode(pass: GPURenderPassEncoder, _camera: Camera): void {
    if (this._count === 0) return;
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(1, this._emptyGroup1);
    pass.setBindGroup(2, this._instancesGroup);
    pass.draw(6, this._count);
  }

  // ── Handle callbacks ───────────────────────────────────────────────────────────

  _setPosition(slot: number, value: Vec3): void {
    const base = slot * INSTANCE_FLOATS;
    this._data[base]     = value[0];
    this._data[base + 1] = value[1];
    this._data[base + 2] = value[2];
    this._writeSlot(slot);
  }

  _getVisible(slot: number): boolean {
    return this._data[slot * INSTANCE_FLOATS + 7] > 0.5;
  }

  _setVisible(slot: number, value: boolean): void {
    this._data[slot * INSTANCE_FLOATS + 7] = value ? 1 : 0;
    this._writeSlot(slot);
  }

  _setPercentage(slot: number, value: number): void {
    this._data[slot * INSTANCE_FLOATS + 3] = value;
    this._writeSlot(slot);
  }

  _destroySlot(slot: number): void {
    this._data[slot * INSTANCE_FLOATS + 7] = 0;
    this._writeSlot(slot);
    this._freeSlots.push(slot);
  }

  // ── Renderable no-ops (manager has no single transform/color) ─────────────────

  setPosition(_position: Vec3):                           void {}
  setQuaternion(_quaternion: Vec4):                       void {}
  setScale(_x: number, _y: number, _z: number):          void {}
  get color(): [number, number, number, number]           { return [0, 0, 0, 0]; }
  setColor(_r: number, _g: number, _b: number, _a: number): void {}
  clone(): Renderable { throw new Error('Bar3DManager is not cloneable'); }

  destroy(): void {
    this._instanceBuffer.destroy();
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  private _writeSlot(slot: number): void {
    this._device.queue.writeBuffer(
      this._instanceBuffer,
      slot * INSTANCE_BYTES,
      this._data,
      slot * INSTANCE_FLOATS,
      INSTANCE_FLOATS,
    );
  }

  private _grow(): void {
    this._capacity *= 2;
    const newData = new Float32Array(this._capacity * INSTANCE_FLOATS) as Float32Array<ArrayBuffer>;
    newData.set(this._data);
    this._data = newData;

    this._instanceBuffer.destroy();
    this._instanceBuffer = this._device.createBuffer({
      label: 'bar3d-instances',
      size:  this._capacity * INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(
      this._instanceBuffer, 0, this._data, 0, this._count * INSTANCE_FLOATS,
    );

    this._instancesGroup = this._device.createBindGroup({
      label:   'bar3d-instances-group',
      layout:  this._instancesLayout,
      entries: [{ binding: 0, resource: { buffer: this._instanceBuffer } }],
    });
  }
}
