import type { Engine } from '@engine';
import type { InputManager } from '../managers/InputManager';
import type { GameScript } from './ScriptContract';

// ── constants ─────────────────────────────────────────────────────────────────
const MOVE_SPEED        = 5.0;   // units/s
const YAW_SPEED         = 1.5;   // rad/s (Q/E keys)
const MOUSE_SENSITIVITY = 0.003; // rad/px

const KEY_FORWARD  = 'KeyW';
const KEY_BACKWARD = 'KeyS';
const KEY_LEFT     = 'KeyA';
const KEY_RIGHT    = 'KeyD';
const KEY_YAW_L    = 'KeyQ';
const KEY_YAW_R    = 'KeyE';
const KEY_UP       = 'Space';
const KEY_DOWN_L   = 'ShiftLeft';
const KEY_DOWN_R   = 'ShiftRight';

export class CameraScript implements GameScript {
  private readonly _inputManager: InputManager;
  private _engine!: Engine;
  private _pendingDeltaX = 0;
  private _pendingDeltaY = 0;

  constructor(inputManager: InputManager) {
    this._inputManager = inputManager;
  }

  async execute(engine: Engine): Promise<void> {
    this._engine = engine;
  }

  receiveMouseDelta(deltaX: number, deltaY: number): void {
    this._pendingDeltaX = deltaX;
    this._pendingDeltaY = deltaY;
  }

  update(deltaTime_number: number): void {
    const camera = this._engine.camera;
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);

    let moveX = 0;
    let moveZ = 0;

    if (this._inputManager.isKeyDown(KEY_FORWARD))  { moveX += sinYaw; moveZ -= cosYaw; }
    if (this._inputManager.isKeyDown(KEY_BACKWARD)) { moveX -= sinYaw; moveZ += cosYaw; }
    if (this._inputManager.isKeyDown(KEY_LEFT))     { moveX -= cosYaw; moveZ -= sinYaw; }
    if (this._inputManager.isKeyDown(KEY_RIGHT))    { moveX += cosYaw; moveZ += sinYaw; }

    if (moveX !== 0 || moveZ !== 0) {
      const length    = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const moveSpeed = MOVE_SPEED * deltaTime_number;
      camera.position[0] += (moveX / length) * moveSpeed;
      camera.position[2] += (moveZ / length) * moveSpeed;
    }

    if (this._inputManager.isKeyDown(KEY_YAW_L)) { camera.yaw -= YAW_SPEED * deltaTime_number; }
    if (this._inputManager.isKeyDown(KEY_YAW_R)) { camera.yaw += YAW_SPEED * deltaTime_number; }

    if (this._inputManager.isKeyDown(KEY_UP)) {
      camera.position[1] += MOVE_SPEED * deltaTime_number;
    }
    if (this._inputManager.isKeyDown(KEY_DOWN_L) || this._inputManager.isKeyDown(KEY_DOWN_R)) {
      camera.position[1] -= MOVE_SPEED * deltaTime_number;
    }

    camera.rotate(
      this._pendingDeltaX * MOUSE_SENSITIVITY,
      this._pendingDeltaY * MOUSE_SENSITIVITY,
    );
    this._pendingDeltaX = 0;
    this._pendingDeltaY = 0;
  }

  destroy(): void {}
}
