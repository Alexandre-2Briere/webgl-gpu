import type { CameraOptions } from '../types'
import { mul4x4 } from '../math'

const PITCH_LIMIT = (89 * Math.PI) / 180

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
  position: Float32Array    // [x, y, z]
  yaw   = 0  // radians, rotation around Y axis
  pitch = 0  // radians, rotation around X axis

  private readonly _fovY: number
  private readonly _near: number
  private readonly _far: number

  private readonly _view    = new Float32Array(16)
  private readonly _proj    = new Float32Array(16)
  private readonly _viewProj = new Float32Array(16)

  private readonly _uniformBuf: GPUBuffer
  private readonly _data = new Float32Array(36)  // 144 bytes / 4

  private _bindGroup!: GPUBindGroup

  constructor(
    device: GPUDevice,
    cameraLayout: GPUBindGroupLayout,
    opts: CameraOptions = {},
  ) {
    this._fovY = opts.fovY ?? Math.PI / 3
    this._near = opts.near ?? 0.1
    this._far  = opts.far  ?? 2000

    const p = opts.position ?? [0, 0, 0]
    this.position = new Float32Array([p[0], p[1], p[2]])
    this.yaw   = opts.yaw   ?? 0
    this.pitch = opts.pitch ?? 0

    this._uniformBuf = device.createBuffer({
      label: 'CameraUniforms',
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this._bindGroup = device.createBindGroup({
      label: 'CameraBindGroup',
      layout: cameraLayout,
      entries: [{ binding: 0, resource: { buffer: this._uniformBuf } }],
    })
  }

  get bindGroup(): GPUBindGroup { return this._bindGroup }

  // ── Movement ────────────────────────────────────────────────────────────────

  /** Set absolute world-space position. */
  setPosition(x: number, y: number, z: number): void {
    this.position[0] = x
    this.position[1] = y
    this.position[2] = z
  }

  /**
   * Move relative to camera-local axes.
   * @param forward  positive = look direction
   * @param right    positive = rightward
   * @param up       positive = world up
   */
  move(forward: number, right: number, up: number): void {
    const cosPitch = Math.cos(this.pitch)
    const sinPitch = Math.sin(this.pitch)
    const cosYaw   = Math.cos(this.yaw)
    const sinYaw   = Math.sin(this.yaw)

    const fx = sinYaw * cosPitch
    const fy = -sinPitch
    const fz = -cosYaw * cosPitch

    const rx = cosYaw
    const rz = sinYaw

    this.position[0] += fx * forward + rx * right
    this.position[1] += fy * forward + up
    this.position[2] += fz * forward + rz * right
  }

  /**
   * Adjust orientation. Pitch is clamped to ±89°.
   * @param deltaYaw    radians, positive = rotate right
   * @param deltaPitch  radians, positive = look up
   */
  rotate(deltaYaw: number, deltaPitch: number): void {
    this.yaw   += deltaYaw
    this.pitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + deltaPitch))
  }

  // ── Matrices ────────────────────────────────────────────────────────────────

  /**
   * Recompute view, projection, and viewProj matrices, then upload to GPU.
   * Call this once per frame after updating position/yaw/pitch.
   */
  updateMatrices(aspectRatio: number): void {
    this._buildView()
    this._buildProj(aspectRatio)
    mul4x4(this._proj, this._view, this._viewProj)

    // Pack into data array
    this._data.set(this._viewProj, 0)   // offset 0
    this._data.set(this._view, 16)      // offset 64
    this._data[32] = this.position[0]   // offset 128
    this._data[33] = this.position[1]
    this._data[34] = this.position[2]
    this._data[35] = 0                  // _pad

    // We need access to device.queue — store a queue reference
    // Note: uploaded by Engine via writeBuffer to avoid storing device ref here
  }

  /** Returns the packed 144-byte camera data ready for queue.writeBuffer. */
  getData(): Float32Array { return this._data }

  uploadTo(queue: GPUQueue): void {
    queue.writeBuffer(this._uniformBuf, 0, this._data)
  }

  // ── Matrix math (column-major, matching WGSL mat4x4f convention) ───────────

  private _buildView(): void {
    const cosPitch = Math.cos(this.pitch)
    const sinPitch = Math.sin(this.pitch)
    const cosYaw   = Math.cos(this.yaw)
    const sinYaw   = Math.sin(this.yaw)

    // Forward direction (looking towards -Z in local space, rotated by yaw then pitch)
    const fx = sinYaw * cosPitch
    const fy = -sinPitch
    const fz = -cosYaw * cosPitch

    // Right = forward × world-up (then normalize)
    const rx = cosYaw
    const ry = 0
    const rz = sinYaw

    // Up = right × forward
    const ux = ry * fz - rz * fy
    const uy = rz * fx - rx * fz
    const uz = rx * fy - ry * fx

    const px = this.position[0]
    const py = this.position[1]
    const pz = this.position[2]

    // View matrix (column-major):
    // col 0: [rx, ux, -fx, 0]
    // col 1: [ry, uy, -fy, 0]
    // col 2: [rz, uz, -fz, 0]
    // col 3: [-dot(r,p), -dot(u,p), dot(f,p), 1]
    const m = this._view
    m[0]  = rx;  m[1]  = ux;  m[2]  = -fx;  m[3]  = 0
    m[4]  = ry;  m[5]  = uy;  m[6]  = -fy;  m[7]  = 0
    m[8]  = rz;  m[9]  = uz;  m[10] = -fz;  m[11] = 0
    m[12] = -(rx * px + ry * py + rz * pz)
    m[13] = -(ux * px + uy * py + uz * pz)
    m[14] =  (fx * px + fy * py + fz * pz)
    m[15] = 1
  }

  private _buildProj(aspect: number): void {
    const f = 1.0 / Math.tan(this._fovY * 0.5)
    const rangeInv = 1.0 / (this._near - this._far)
    const m = this._proj
    m.fill(0)
    m[0]  = f / aspect
    m[5]  = f
    m[10] = this._far * rangeInv
    m[11] = -1
    m[14] = this._near * this._far * rangeInv
  }

  destroy(): void {
    this._uniformBuf.destroy()
  }
}
