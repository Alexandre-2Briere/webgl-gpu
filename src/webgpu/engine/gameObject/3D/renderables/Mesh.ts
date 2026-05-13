import type { Renderable, RenderableInitArgs } from '../../Renderable';
import type { MeshOptions } from '../../../types';
import type { Camera } from '../../../core/Camera';
import { VertexBuffer } from '../../../buffers/VertexBuffer';
import type { UniformPool, UniformSlot } from '../../../buffers/UniformPool';
import { COMMON } from '../../../shaders/common';
import { PHONG } from '../../../shaders/phong';
import { MESH_PHONG } from '../../../shaders/meshPhong';
import { makeTransformMatrix, identityMat } from '../../../math/mat';
import type { Vec3, Vec4 } from '../../../math/vec';
import type { Material } from '../../../material/Material';


/** Bytes per vertex: vec3f pos + f32 pad + vec3f normal + f32 pad + vec4f color + vec2f uv = 56 */
const BYTES_PER_VERTEX = 56;

/** @internal */
export const MESH_PIPELINE_KEY = 'mesh-phong';

/** @internal */
export class Mesh implements Renderable {
  readonly id = Symbol();
  readonly layer = 'world' as const;
  readonly pipelineKey = MESH_PIPELINE_KEY;
  visible = true;

  private readonly _opts: MeshOptions;
  private _vertexBuf!: VertexBuffer;
  private _indexBuf?: GPUBuffer;
  private _indexCount = 0;
  private _vertexCount = 0;
  private _uniformSlot!: UniformSlot;
  private _uniformPool!: UniformPool;
  private _objectBindGroup!: GPUBindGroup;
  private _pipeline!: GPURenderPipeline;
  private _device!: GPUDevice;
  private _queue!: GPUQueue;
  private _uniformData = new Float32Array(20);  // 16 (mat4) + 4 (tint) = 80 bytes

  private _material: Material | null = null;
  private _nullMaterialBindGroup!: GPUBindGroup;
  private _nullMaterialBuffer!: GPUBuffer;
  private _nullTexture!: GPUTexture;

  private _position:   Vec3 = [0, 0, 0];
  private _quaternion: Vec4 = [0, 0, 0, 1];
  private _scale:      Vec3 = [1, 1, 1];

  constructor(opts: MeshOptions) {
    this._opts = opts;
    this._uniformData.set(identityMat(4), 0);
    this._uniformData.set([1, 1, 1, 1], 16);
  }

  /** @internal — called by GameObject.setMaterial() only */
  setMaterial(material: Material | null): void {
    this._material = material;
  }

  init(args: RenderableInitArgs): void {
    const { device, queue, format, pipelineCache, layouts, uniformPool } = args;
    this._device = device;
    this._queue = queue;
    this._uniformPool = uniformPool;

    // ── Vertex buffer ────────────────────────────────────────────────────────
    const verts = this._opts.vertices;
    this._vertexBuf = new VertexBuffer(device, verts.byteLength, this._opts.label);
    this._vertexBuf.write(verts);
    this._vertexCount = verts.byteLength / BYTES_PER_VERTEX;

    // ── Index buffer ─────────────────────────────────────────────────────────
    if (this._opts.indices) {
      const idx = this._opts.indices;
      this._indexBuf = device.createBuffer({
        label: this._opts.label ? `${this._opts.label}:idx` : undefined,
        size: idx.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      queue.writeBuffer(this._indexBuf, 0, idx as Uint32Array<ArrayBuffer>);
      this._indexCount = idx.length;
    }

    // ── Object uniform ───────────────────────────────────────────────────────
    this._uniformSlot = uniformPool.allocate(80);
    uniformPool.write(this._uniformSlot, this._uniformData);

    this._objectBindGroup = device.createBindGroup({
      label: this._opts.label ? `${this._opts.label}:obj` : 'mesh:obj',
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

    // ── Null material (used when no Material is assigned) ────────────────────
    this._nullMaterialBuffer = device.createBuffer({
      label: 'mesh-null-material-uniform',
      size:  16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // shininess=32, specularStrength=0, hasTexture=0, pad=0
    const nullData = new ArrayBuffer(16);
    const nullView = new DataView(nullData);
    nullView.setFloat32(0, 32, true);
    nullView.setFloat32(4, 0,  true);
    nullView.setUint32( 8, 0,  true);
    nullView.setFloat32(12, 0, true);
    queue.writeBuffer(this._nullMaterialBuffer, 0, nullData);

    this._nullTexture = device.createTexture({
      label:  'mesh-null-tex',
      size:   [1, 1, 1],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    queue.writeTexture(
      { texture: this._nullTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1, 1],
    );

    const nullSampler = device.createSampler({ label: 'mesh-null-sampler', magFilter: 'linear', minFilter: 'linear' });

    this._nullMaterialBindGroup = device.createBindGroup({
      label:   'mesh-null-material-bg',
      layout:  layouts.meshMaterial,
      entries: [
        { binding: 0, resource: { buffer: this._nullMaterialBuffer } },
        { binding: 1, resource: this._nullTexture.createView() },
        { binding: 2, resource: nullSampler },
      ],
    });

    // ── Render pipeline ──────────────────────────────────────────────────────
    const shaderModule = device.createShaderModule({
      label: 'mesh-phong-shader',
      code:  COMMON + '\n' + PHONG + '\n' + MESH_PHONG,
    });

    this._pipeline = pipelineCache.getOrCreateRender(MESH_PIPELINE_KEY, {
      label: 'mesh-phong-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [layouts.camera, layouts.object, layouts.meshMaterial, layouts.lights],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: BYTES_PER_VERTEX,
          attributes: [
            { shaderLocation: 0, offset:  0, format: 'float32x3' },  // position
            { shaderLocation: 1, offset: 16, format: 'float32x3' },  // normal
            { shaderLocation: 2, offset: 32, format: 'float32x4' },  // color
            { shaderLocation: 3, offset: 48, format: 'float32x2' },  // uv
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
        frontFace: 'ccw',
        cullMode: 'back',
      },
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
    pass.setBindGroup(2, this._material?.bindGroup ?? this._nullMaterialBindGroup);
    pass.setVertexBuffer(0, this._vertexBuf.buffer);
    if (this._indexBuf) {
      pass.setIndexBuffer(this._indexBuf, 'uint32');
      pass.drawIndexed(this._indexCount);
    } else {
      pass.draw(this._vertexCount);
    }
  }

  // ── MeshHandle ──────────────────────────────────────────────────────────────

  setVertices(data: Float32Array): void {
    this._vertexBuf.write(data);
    this._vertexCount = data.byteLength / BYTES_PER_VERTEX;
  }

  setIndices(data: Uint32Array): void {
    if (!this._indexBuf || this._indexBuf.size < data.byteLength) {
      this._indexBuf?.destroy();
      this._indexBuf = this._device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
    }
    this._queue.writeBuffer(this._indexBuf, 0, data as Uint32Array<ArrayBuffer>);
    this._indexCount = data.length;
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

  setModelMatrix(mat: Float32Array): void {
    this._uniformData.set(mat, 0);
    this._device.queue.writeBuffer(
      this._uniformSlot.buffer, this._uniformSlot.offset, this._uniformData
    );
  }

  private _rebuildMatrix(): void {
    makeTransformMatrix(this._position, this._quaternion, this._scale, this._uniformData);
    this._device.queue.writeBuffer(
      this._uniformSlot.buffer, this._uniformSlot.offset, this._uniformData
    );
  }

  get color(): [number, number, number, number] {
    return [this._uniformData[16], this._uniformData[17], this._uniformData[18], this._uniformData[19]];
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

  clone(): Mesh {
    return new Mesh({
      vertices: new Float32Array(this._opts.vertices),
      indices: this._opts.indices ? new Uint32Array(this._opts.indices) : undefined,
      label: this._opts.label,
    });
  }

  destroy(): void {
    this._uniformPool.free(this._uniformSlot);
    this._vertexBuf.destroy();
    this._indexBuf?.destroy();
    this._nullMaterialBuffer.destroy();
    this._nullTexture.destroy();
  }
}
