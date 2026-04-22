import type { Renderable, RenderableInitArgs } from './Renderable';
import type { Camera } from '../../core/Camera';
import type { UniformPool, UniformSlot } from '../../buffers/UniformPool';
import { COMMON } from '../../shaders/common';
import { INFINITE_GROUND } from '../../shaders/infiniteGround';
import { makeTransformMatrix } from '../../math';
import type { Vec3, Vec4 } from '../../math';

/** Half-size of the ground quad in world units (total = 100 000 × 100 000). */
const HALF_SIZE = 50_000;
const BYTES_PER_VERTEX = 16;  // vec3f position + f32 pad
const INFINITE_GROUND_PIPELINE_KEY = 'infinite-ground';

// Flat quad at Y=0, XZ ± HALF_SIZE
const GROUND_VERTICES = new Float32Array([
  -HALF_SIZE, 0, -HALF_SIZE, 0,
   HALF_SIZE, 0, -HALF_SIZE, 0,
   HALF_SIZE, 0,  HALF_SIZE, 0,
  -HALF_SIZE, 0,  HALF_SIZE, 0,
]);
const GROUND_INDICES = new Uint16Array([0, 1, 2, 2, 3, 0]);

// groundExtra uniform layout: color2 (vec4f = 16 bytes) + tileSize (f32 = 4 bytes) + pad (12 bytes) = 32 bytes
const GROUND_EXTRA_SIZE = 32;

/**
 * Infinite checkerboard ground plane rendered as a 100k×100k flat quad.
 * Uses a custom groundExtra uniform at group 2 for the secondary tile color
 * and tile size; the primary color lives in the standard object tint (group 1).
 * @internal
 */
export class InfiniteGroundRenderable implements Renderable {
  readonly id = Symbol();
  readonly layer = 'world' as const;
  readonly pipelineKey = INFINITE_GROUND_PIPELINE_KEY;
  visible = true;

  private _uniformSlot!: UniformSlot;
  private _uniformPool!: UniformPool;
  private _objectBindGroup!: GPUBindGroup;
  private _groundExtraBuf!: GPUBuffer;
  private _groundExtraBindGroup!: GPUBindGroup;
  private _pipeline!: GPURenderPipeline;
  private _vertexBuf!: GPUBuffer;
  private _indexBuf!: GPUBuffer;
  private _device!: GPUDevice;

  // Object uniform: 16 floats model + 4 floats tint = 80 bytes
  private _uniformData = new Float32Array(20);
  // groundExtra: color2 (4 floats) + tileSize (1 float) + pad (3 floats) = 8 floats
  private _groundExtraData = new Float32Array(8);

  private _position: Vec3 = [0, 0, 0];
  private readonly _quaternion: Vec4 = [0, 0, 0, 1];
  private readonly _scale: Vec3 = [1, 1, 1];

  constructor(opts: {
    color?:          [number, number, number, number]
    alternateColor?: [number, number, number, number]
    tileSize?:       number
    yLevel?:         number
  } = {}) {
    // Identity matrix for model
    this._uniformData[0]  = 1; this._uniformData[5]  = 1;
    this._uniformData[10] = 1; this._uniformData[15] = 1;

    const color1: [number, number, number, number] = opts.color          ?? [0.55, 0.55, 0.55, 1];
    const color2: [number, number, number, number] = opts.alternateColor ?? [0.45, 0.45, 0.45, 1];
    const tileSize = opts.tileSize ?? 4;
    const yLevel   = opts.yLevel   ?? 0;

    this._uniformData.set(color1, 16);
    this._groundExtraData.set(color2, 0);
    this._groundExtraData[4] = tileSize;

    if (yLevel !== 0) {
      this._position = [0, yLevel, 0];
      makeTransformMatrix(this._position, this._quaternion, this._scale, this._uniformData);
    }
  }

  init(args: RenderableInitArgs): void {
    const { device, queue, format, pipelineCache, layouts, uniformPool } = args;
    this._device = device;
    this._uniformPool = uniformPool;

    // ── Vertex buffer ────────────────────────────────────────────────────────
    this._vertexBuf = device.createBuffer({
      label: 'infinite-ground:verts',
      size:  GROUND_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._vertexBuf, 0, GROUND_VERTICES);

    // ── Index buffer ─────────────────────────────────────────────────────────
    this._indexBuf = device.createBuffer({
      label: 'infinite-ground:idx',
      size:  GROUND_INDICES.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._indexBuf, 0, GROUND_INDICES);

    // ── Object uniform (group 1) ─────────────────────────────────────────────
    this._uniformSlot = uniformPool.allocate(80);
    uniformPool.write(this._uniformSlot, this._uniformData);

    this._objectBindGroup = device.createBindGroup({
      label: 'infinite-ground:obj',
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

    // ── Ground extra uniform (group 2) ───────────────────────────────────────
    this._groundExtraBuf = device.createBuffer({
      label: 'infinite-ground:extra',
      size:  GROUND_EXTRA_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._groundExtraBuf, 0, this._groundExtraData);

    this._groundExtraBindGroup = device.createBindGroup({
      label: 'infinite-ground:extra-bg',
      layout: layouts.groundExtra,
      entries: [{ binding: 0, resource: { buffer: this._groundExtraBuf } }],
    });

    // ── Render pipeline ──────────────────────────────────────────────────────
    const shaderSrc = COMMON + '\n' + INFINITE_GROUND;
    const shaderModule = device.createShaderModule({ label: 'infinite-ground-shader', code: shaderSrc });

    this._pipeline = pipelineCache.getOrCreateRender(INFINITE_GROUND_PIPELINE_KEY, {
      label: 'infinite-ground-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [layouts.camera, layouts.object, layouts.groundExtra, layouts.lights],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: BYTES_PER_VERTEX,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  encode(pass: GPURenderPassEncoder, _camera: Camera): void {
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(1, this._objectBindGroup);
    pass.setBindGroup(2, this._groundExtraBindGroup);
    pass.setVertexBuffer(0, this._vertexBuf);
    pass.setIndexBuffer(this._indexBuf, 'uint16');
    pass.drawIndexed(6);
  }

  // ── Color1 (primary) ─────────────────────────────────────────────────────────

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

  // ── Color2 (alternate) ───────────────────────────────────────────────────────

  get alternateColor(): [number, number, number, number] {
    return [
      this._groundExtraData[0],
      this._groundExtraData[1],
      this._groundExtraData[2],
      this._groundExtraData[3],
    ];
  }

  setAlternateColor(r: number, g: number, b: number, a: number): void {
    this._groundExtraData[0] = r;
    this._groundExtraData[1] = g;
    this._groundExtraData[2] = b;
    this._groundExtraData[3] = a;
    this._device.queue.writeBuffer(this._groundExtraBuf, 0, this._groundExtraData);
  }

  // ── Tile size ────────────────────────────────────────────────────────────────

  get tileSize(): number { return this._groundExtraData[4]; }

  setTileSize(size: number): void {
    this._groundExtraData[4] = size;
    this._device.queue.writeBuffer(this._groundExtraBuf, 0, this._groundExtraData);
  }

  // ── Y level (position) ───────────────────────────────────────────────────────

  get yLevel(): number { return this._position[1]; }

  setPosition(position: Vec3): void {
    this._position = [...position];
    this._rebuildMatrix();
  }

  setQuaternion(_quaternion: Vec4): void {}
  setScale(_x: number, _y: number, _z: number): void {}

  private _rebuildMatrix(): void {
    makeTransformMatrix(this._position, this._quaternion, this._scale, this._uniformData);
    this._device.queue.writeBuffer(
      this._uniformSlot.buffer, this._uniformSlot.offset, this._uniformData
    );
  }

  clone(): InfiniteGroundRenderable {
    return new InfiniteGroundRenderable({
      color:          [...this.color],
      alternateColor: [...this.alternateColor],
      tileSize:       this.tileSize,
      yLevel:         this.yLevel,
    });
  }

  destroy(): void {
    this._uniformPool.free(this._uniformSlot);
    this._vertexBuf.destroy();
    this._indexBuf.destroy();
    this._groundExtraBuf.destroy();
  }
}
