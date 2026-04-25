import type { Engine, ArrowGizmo } from '@engine';
import type { InputManager } from '../managers/InputManager';
import type { SelectionManager } from '../managers/SelectionManager';
import type { SpawnManager } from '../managers/SpawnManager';
import { SANDBOX_EVENTS, type PubSubManager } from '../events';

const DRAG_SPEED = 0.01;  // world units per pixel

export class GizmoController {
  private readonly _engine:            Engine;
  private readonly _inputManager:      InputManager;
  private readonly _selectionManager:  SelectionManager;
  private readonly _spawnManager:      SpawnManager;
  private readonly _isPlaying:         () => boolean;
  private readonly _pubSub:            PubSubManager;

  private _gizmo:               ArrowGizmo | null = null;
  private _draggingAxis: 0 | 1 | 2 | null = null;

  constructor(
    engine:           Engine,
    inputManager:     InputManager,
    selectionManager: SelectionManager,
    spawnManager:     SpawnManager,
    isPlaying:        () => boolean,
    pubSub:           PubSubManager,
  ) {
    this._engine           = engine;
    this._inputManager     = inputManager;
    this._selectionManager = selectionManager;
    this._spawnManager     = spawnManager;
    this._isPlaying        = isPlaying;
    this._pubSub           = pubSub;
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  create(): void {
    this._gizmo = this._engine.createArrowGizmo();
    this._selectionManager.setGizmo(this._gizmo);
    this._attachMouseListeners();

    this._pubSub.subscribe(SANDBOX_EVENTS.PLAY_STOPPED, () => {
      this.sync();
    });
  }

  getGizmo(): ArrowGizmo | null {
    return this._gizmo;
  }

  isDragging(): boolean {
    return this._draggingAxis !== null;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────────

  sync(): void {
    const selectedIndex = this._selectionManager.getSelectedIndex();
    if (!this._gizmo?.visible || selectedIndex < 0 || this._isPlaying()) return;
    const obj = this._spawnManager.getObject(selectedIndex);
    if (!obj) return;
    const position = obj.gameObject.position;
    this._gizmo.setPosition([position[0], position[1], position[2]]);
  }

  applyDrag(): void {
    const selectedIndex = this._selectionManager.getSelectedIndex();
    if (this._draggingAxis === null || !this._inputManager.isMouseButtonDown() ||
        selectedIndex < 0 || this._isPlaying()) return;

    const obj = this._spawnManager.getObject(selectedIndex);
    if (!obj) return;

    const [deltaX, deltaY] = this._inputManager.readMouseDelta();
    const axis  = this._draggingAxis;
    const delta = axis === 1 ? -deltaY * DRAG_SPEED : deltaX * DRAG_SPEED;
    const pos   = obj.gameObject.position as [number, number, number];
    pos[axis] += delta;
    this._pubSub.publish(SANDBOX_EVENTS.PROPERTY_PANEL_SET_POSITION, { x: pos[0], y: pos[1], z: pos[2] });
  }

  // ── Mouse listeners ───────────────────────────────────────────────────────────

  private _attachMouseListeners(): void {
    const canvas = this._engine.canvas as HTMLCanvasElement;

    canvas.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button !== 0 || this._isPlaying() || !this._gizmo?.visible) return;

      const canvasRect = canvas.getBoundingClientRect();
      const clickNdcX  = ((event.clientX - canvasRect.left) / canvasRect.width)  * 2 - 1;
      const clickNdcY  = 1 - ((event.clientY - canvasRect.top) / canvasRect.height) * 2;
      const viewProj   = this._engine.camera.getData();
      const gizmoPos   = this._gizmo.position;

      const AXIS_DIRECTIONS: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      let bestAxis: 0 | 1 | 2 | null = null;
      let bestDistance = 0.12;

      for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
        const [axisX, axisY, axisZ] = AXIS_DIRECTIONS[axisIndex];
        const worldX = gizmoPos[0] + axisX * 0.5;
        const worldY = gizmoPos[1] + axisY * 0.5;
        const worldZ = gizmoPos[2] + axisZ * 0.5;
        const clipX  = viewProj[0]*worldX + viewProj[4]*worldY + viewProj[8]*worldZ  + viewProj[12];
        const clipY  = viewProj[1]*worldX + viewProj[5]*worldY + viewProj[9]*worldZ  + viewProj[13];
        const clipW  = viewProj[3]*worldX + viewProj[7]*worldY + viewProj[11]*worldZ + viewProj[15];
        if (clipW <= 0) continue;

        const distance = Math.hypot(clipX / clipW - clickNdcX, clipY / clipW - clickNdcY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestAxis     = axisIndex as 0 | 1 | 2;
        }
      }

      if (bestAxis !== null) {
        this._draggingAxis = bestAxis;
      }
    });

    window.addEventListener('mouseup', (event: MouseEvent) => {
      if (event.button === 0) this._draggingAxis = null;
    });
  }
}
