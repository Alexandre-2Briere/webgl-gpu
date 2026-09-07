import type { CameraOptions } from '../types';
import { forward, right, up, dot, type Vec2 } from '../math/vec';
import { mul4x4 } from '../math/mat';

const PITCH_LIMIT = (89 * Math.PI) / 180;

/**
 * Manages view/projection matrices and a 144-byte GPU uniform buffer.
 *
 * Buffer layout:
 *   offset   0: mat4x4f viewProj  (64 bytes)
 *   offset  64: mat4x4f view      (64 bytes)
 *   offset 128: vec3f   position  (12 bytes)
 *   offset 140: f32     _pad      ( 4 bytes)
 */
export class Camera {
  position: Float32Array;    // [x, y, z]
  private _rotation: Float32Array;  // [rotX, rotY, rotZ]

  private readonly _uniformBuf: GPUBuffer;
  private readonly _data = new Float32Array(36);  // 144 bytes / 4

  private _bindGroup!: GPUBindGroup;

  constructor(
    device: GPUDevice,
    cameraLayout: GPUBindGroupLayout,
    opts: CameraOptions = {},
  ) {
    const p = opts.position ?? [0, 0, 0];
    this.position = new Float32Array([p[0], p[1], p[2]]);
    const r = opts.rotation ?? [0, 0, 0];
    this._rotation = new Float32Array([r[0], r[1], r[2]]);

    this._uniformBuf = device.createBuffer({
      label: 'CameraUniforms',
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._bindGroup = device.createBindGroup({
      label: 'CameraBindGroup',
      layout: cameraLayout,
      entries: [{ binding: 0, resource: { buffer: this._uniformBuf } }],
    });
  }

  get bindGroup(): GPUBindGroup { return this._bindGroup; }

  set rotation(value: [number, number, number]) { 
    value[0] > 360 ? value[0] -= 360 : value[0] < 0 ? value[0] += 360 : 0;
    value[1] > 360 ? value[1] -= 360 : value[1] < 0 ? value[1] += 360 : 0;
    value[2] > 360 ? value[2] -= 360 : value[2] < 0 ? value[2] += 360 : 0;
    this._rotation.set(value); 
  }
  get rotation(): [number, number, number] { return [this._rotation[0], this._rotation[1], this._rotation[2]]; }
  // ── Movement ────────────────────────────────────────────────────────────────

  /** Set absolute world-space position. */
  setPosition(x: number, y: number, z: number): void {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
  }

  /**
   * Move relative to camera-local axes.
   * @param forward  positive = look direction
   * @param right    positive = rightward
   * @param up       positive = world up
   */
  translate(x: number, y: number, z: number): void {
    this.position[0] += x;
    this.position[1] += y;
    this.position[2] += z;
  }

  /**
   * Adjust orientation. Pitch is clamped to ±89°.
   * @param deltaYaw    radians, positive = rotate right
   * @param deltaPitch  radians, positive = look up
   */
  rotate(x: number, y: number, z: number): void {

  }

  // ── Matrices ────────────────────────────────────────────────────────────────

  /**
   * Recompute view, projection, and viewProj matrices, then upload to GPU.
   * Call this once per frame after updating position/yaw/pitch.
   */
  updateMatrices(aspectRatio: number): void {
  }

  /** Returns the packed 144-byte camera data ready for queue.writeBuffer. */
  getData(): Float32Array { return this._data; }

  uploadTo(queue: GPUQueue): void {
    queue.writeBuffer(this._uniformBuf, 0, this._data);
  }

  // ── Matrix math (column-major, matching WGSL mat4x4f convention) ───────────

  /**
   * Builds a column-major view matrix from current yaw/pitch/position.
   * Rotation rows = [right, up, -forward]; translation column = projection of
   * camera position onto each basis axis (expressing world origin in camera space).
   */
  private _buildView(): void {

  }

  /**
   * Builds a column-major perspective projection matrix.
   * Produces WebGPU NDC depth [0, 1] (not OpenGL [-1, 1]).
   * m[11] = -1 triggers the perspective divide; m[10]/m[14] encode the depth range.
   */
  private _buildProj(): void {
  }

  destroy(): void {
    this._uniformBuf.destroy();
  }
}
