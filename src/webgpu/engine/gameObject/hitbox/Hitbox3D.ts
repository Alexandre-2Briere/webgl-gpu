import { makeTRS } from '../../math/mat4'

export type HitboxType = 'cube' | 'sphere' | 'capsule' | 'mesh'

function yawPitchToQuat(yaw: number, pitch: number): [number, number, number, number] {
  const cy = Math.cos(yaw * 0.5)
  const sy = Math.sin(yaw * 0.5)
  const cp = Math.cos(pitch * 0.5)
  const sp = Math.sin(pitch * 0.5)
  // qYaw * qPitch
  return [cy * sp, sy * cp, -sy * sp, cy * cp]
}

function mulQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

function rotateByQuat(
  v: [number, number, number],
  q: [number, number, number, number],
): [number, number, number] {
  const [qx, qy, qz, qw] = q
  const [vx, vy, vz] = v
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ]
}

export abstract class Hitbox3D {
  offsetTranslation: [number, number, number]
  /** [yaw, pitch] in radians — local rotation offset relative to renderable */
  offsetRotation: [number, number]

  /** Column-major mat4 — world transform of this hitbox (no scale). Updated by GameObject each frame. */
  readonly orientation = new Float32Array(16)

  constructor(
    offsetTranslation: [number, number, number] = [0, 0, 0],
    offsetRotation: [number, number] = [0, 0],
  ) {
    this.offsetTranslation = offsetTranslation
    this.offsetRotation = offsetRotation
    // Identity
    this.orientation[0] = 1
    this.orientation[5] = 1
    this.orientation[10] = 1
    this.orientation[15] = 1
  }

  abstract readonly type: HitboxType

  /** World-space center extracted from orientation matrix. */
  get worldCenter(): [number, number, number] {
    return [this.orientation[12], this.orientation[13], this.orientation[14]]
  }

  /**
   * Rebuild orientation from the owning renderable's world transform.
   * Called by GameObject.syncHitbox() each frame.
   */
  updateOrientation(
    renderablePosition: [number, number, number],
    renderableQuaternion: [number, number, number, number],
  ): void {
    const offsetQuat = yawPitchToQuat(this.offsetRotation[0], this.offsetRotation[1])
    const worldQuat = mulQuat(renderableQuaternion, offsetQuat)
    const rotatedOffset = rotateByQuat(this.offsetTranslation, renderableQuaternion)
    const worldPos: [number, number, number] = [
      renderablePosition[0] + rotatedOffset[0],
      renderablePosition[1] + rotatedOffset[1],
      renderablePosition[2] + rotatedOffset[2],
    ]
    makeTRS(worldPos, worldQuat, [1, 1, 1], this.orientation)
  }
}
