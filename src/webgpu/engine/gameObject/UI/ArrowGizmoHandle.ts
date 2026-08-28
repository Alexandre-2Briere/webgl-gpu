import { ArrowGizmo } from './renderable/ArrowGizmo';

export class ArrowGizmoHandle {
  private          _destroyed = false;
  private readonly _gizmo: ArrowGizmo;

  /** @internal */
  constructor(gizmo: ArrowGizmo) {
    this._gizmo = gizmo;
  }

  get position(): [number, number, number] { return this._gizmo.position; }
  set position(value: [number, number, number]) { this._gizmo.setPosition(value); }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
  }
}
