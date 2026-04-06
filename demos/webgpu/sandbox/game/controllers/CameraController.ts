import type { Engine } from '../../../../../src/webgpu/engine/index'
import type { InputManager } from '../managers/InputManager'

const CAMERA_MOVE_SPEED = 5.0   // units per second
const CAMERA_YAW_SPEED  = 1.5   // radians per second (Q/E keys)
const MOUSE_SENSITIVITY = 0.003  // radians per pixel

export class CameraController {
  private readonly _engine:       Engine
  private readonly _inputManager: InputManager
  private readonly _isPlaying:    () => boolean

  constructor(engine: Engine, inputManager: InputManager, isPlaying: () => boolean) {
    this._engine       = engine
    this._inputManager = inputManager
    this._isPlaying    = isPlaying
  }

  // ── Per-frame: keyboard movement ──────────────────────────────────────────────

  tick(deltaTime: number): void {
    if (!this._isPlaying()) return

    const camera = this._engine.camera
    const cosYaw = Math.cos(camera.yaw)
    const sinYaw = Math.sin(camera.yaw)

    let moveX = 0
    let moveZ = 0

    if (this._inputManager.isKeyDown('KeyW')) { moveX += sinYaw; moveZ -= cosYaw }
    if (this._inputManager.isKeyDown('KeyS')) { moveX -= sinYaw; moveZ += cosYaw }
    if (this._inputManager.isKeyDown('KeyA')) { moveX -= cosYaw; moveZ -= sinYaw }
    if (this._inputManager.isKeyDown('KeyD')) { moveX += cosYaw; moveZ += sinYaw }

    if (moveX !== 0 || moveZ !== 0) {
      const length    = Math.sqrt(moveX * moveX + moveZ * moveZ)
      const moveSpeed = CAMERA_MOVE_SPEED * deltaTime
      camera.position[0] += (moveX / length) * moveSpeed
      camera.position[2] += (moveZ / length) * moveSpeed
    }

    if (this._inputManager.isKeyDown('KeyQ')) { camera.yaw -= CAMERA_YAW_SPEED * deltaTime }
    if (this._inputManager.isKeyDown('KeyE')) { camera.yaw += CAMERA_YAW_SPEED * deltaTime }

    if (this._inputManager.isKeyDown('Space')) {
      camera.position[1] += CAMERA_MOVE_SPEED * deltaTime
    }
    if (this._inputManager.isKeyDown('ShiftLeft') || this._inputManager.isKeyDown('ShiftRight')) {
      camera.position[1] -= CAMERA_MOVE_SPEED * deltaTime
    }
  }

  // ── Mouse rotation: edit mode (drag) ─────────────────────────────────────────

  applyMouseRotation(deltaX: number, deltaY: number): void {
    this._engine.camera.rotate(
      -deltaX * MOUSE_SENSITIVITY,
      -deltaY * MOUSE_SENSITIVITY,
    )
  }

  // ── Mouse rotation: play mode (pointer lock) ──────────────────────────────────

  applyPointerLockRotation(deltaX: number, deltaY: number): void {
    this._engine.camera.rotate(
      deltaX * MOUSE_SENSITIVITY,
      deltaY * MOUSE_SENSITIVITY,
    )
  }
}
