import type { Bar3DManager } from '../3D/renderables/Bar3DManager';
import type { Vec3 } from '../../math/vec';

export class Bar3DHandle {
  private readonly _manager:  Bar3DManager;
  private readonly _slot:     number;
  private          _position: Vec3 = [0, 0, 0];
  private          _destroyed = false;

  /** @internal */
  constructor(manager: Bar3DManager, slot: number, position: Vec3) {
    this._manager  = manager;
    this._slot     = slot;
    this._position = [...position] as Vec3;
  }

  get position(): Vec3 { return [...this._position] as Vec3; }
  set position(value: Vec3) {
    this._position = [...value] as Vec3;
    this._manager._setPosition(this._slot, value);
  }

  get visible(): boolean { return this._manager._getVisible(this._slot); }
  set visible(value: boolean) { this._manager._setVisible(this._slot, value); }

  setPosition(value: Vec3): void {
    this._position = [...value] as Vec3;
    this._manager._setPosition(this._slot, value);
  }

  setPercentage(value: number): void {
    this._manager._setPercentage(this._slot, Math.max(0, Math.min(1, value)));
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._manager._destroySlot(this._slot);
  }
}
