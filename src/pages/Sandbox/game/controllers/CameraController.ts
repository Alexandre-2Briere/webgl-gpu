import type { Engine } from '@engine';
import type { InputManager } from '../managers/InputManager';
import type { PubSubManager } from '../events';
import { SANDBOX_EVENTS } from '../events';

const CAMERA_MOVE_SPEED = 5.0;   // units per second
const CAMERA_YAW_SPEED  = 1.5;   // radians per second (Q/E keys)
const MOUSE_SENSITIVITY = 0.003;  // radians per pixel

export const CameraState = {
  Idle:     0,
  Dragging: 1,
  Blocked:  2,
} as const;

export type CameraState = typeof CameraState[keyof typeof CameraState];

export class CameraController {
  private readonly _engine:       Engine;
  private readonly _inputManager: InputManager;
  private readonly _isPlaying:    () => boolean;
  private readonly _pubSub:       PubSubManager;

  private _state:                          CameraState = CameraState.Idle;
  private _mouseRotationCalledPreviousFrame             = false;

  constructor(engine: Engine, inputManager: InputManager, isPlaying: () => boolean, pubSub: PubSubManager) {
    this._engine       = engine;
    this._inputManager = inputManager;
    this._isPlaying    = isPlaying;
    this._pubSub       = pubSub;

    pubSub.subscribe(SANDBOX_EVENTS.UI_RESIZE_STARTED, () => {
      this._state = CameraState.Blocked;
    });
    pubSub.subscribe(SANDBOX_EVENTS.UI_RESIZE_ENDED, () => {
      if (this._state === CameraState.Blocked) this._state = CameraState.Idle;
    });
  }

  // ── Per-frame: keyboard movement ──────────────────────────────────────────────

  tick(deltaTime: number): void {
    if (this._state === CameraState.Blocked) return;

    if (this._state === CameraState.Dragging && !this._mouseRotationCalledPreviousFrame) {
      this._state = CameraState.Idle;
      this._pubSub.publish(SANDBOX_EVENTS.CAMERA_DRAG_ENDED);
    }
    this._mouseRotationCalledPreviousFrame = false;

    if (!this._isPlaying()) return;

    const camera = this._engine.camera;
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);

    let moveX = 0;
    let moveZ = 0;

    if (this._inputManager.isKeyDown('KeyW')) { moveX += sinYaw; moveZ -= cosYaw; }
    if (this._inputManager.isKeyDown('KeyS')) { moveX -= sinYaw; moveZ += cosYaw; }
    if (this._inputManager.isKeyDown('KeyA')) { moveX -= cosYaw; moveZ -= sinYaw; }
    if (this._inputManager.isKeyDown('KeyD')) { moveX += cosYaw; moveZ += sinYaw; }

    if (moveX !== 0 || moveZ !== 0) {
      const length    = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const moveSpeed = CAMERA_MOVE_SPEED * deltaTime;
      camera.position[0] += (moveX / length) * moveSpeed;
      camera.position[2] += (moveZ / length) * moveSpeed;
    }

    if (this._inputManager.isKeyDown('KeyQ')) { camera.yaw -= CAMERA_YAW_SPEED * deltaTime; }
    if (this._inputManager.isKeyDown('KeyE')) { camera.yaw += CAMERA_YAW_SPEED * deltaTime; }

    if (this._inputManager.isKeyDown('Space')) {
      camera.position[1] += CAMERA_MOVE_SPEED * deltaTime;
    }
    if (this._inputManager.isKeyDown('ShiftLeft') || this._inputManager.isKeyDown('ShiftRight')) {
      camera.position[1] -= CAMERA_MOVE_SPEED * deltaTime;
    }
  }

  // ── Mouse rotation: edit mode (drag) ─────────────────────────────────────────

  applyMouseRotation(deltaX: number, deltaY: number): void {
    if (this._state === CameraState.Blocked) return;

    this._mouseRotationCalledPreviousFrame = true;

    if (this._state === CameraState.Idle) {
      this._state = CameraState.Dragging;
      this._pubSub.publish(SANDBOX_EVENTS.CAMERA_DRAG_STARTED);
    }

    this._engine.camera.rotate(
      -deltaX * MOUSE_SENSITIVITY,
      -deltaY * MOUSE_SENSITIVITY,
    );
  }

  // ── Mouse rotation: play mode (pointer lock) ──────────────────────────────────

  applyPointerLockRotation(deltaX: number, deltaY: number): void {
    if (this._state === CameraState.Blocked) return;

    this._engine.camera.rotate(
      deltaX * MOUSE_SENSITIVITY,
      deltaY * MOUSE_SENSITIVITY,
    );
  }
}
