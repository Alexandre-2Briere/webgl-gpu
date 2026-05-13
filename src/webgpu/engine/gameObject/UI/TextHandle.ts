import type { TextManager } from './renderable/TextManager';
import type { Vec3 } from '../../math/vec';

export class TextHandle {
  readonly uiType = 'text' as const;

  private readonly _manager:    TextManager;
  private readonly _slotIndex:  number;
  private          _destroyed = false;

  /** @internal */
  constructor(manager: TextManager, slotIndex: number) {
    this._manager   = manager;
    this._slotIndex = slotIndex;
  }

  get visible(): boolean { return this._manager._getVisible(this._slotIndex); }
  set visible(value: boolean) { this._manager._setVisible(this._slotIndex, value); }

  get showDebugBounds(): boolean { return this._manager._getDebugBounds(this._slotIndex); }
  set showDebugBounds(value: boolean) {
    if (this._destroyed) return;
    this._manager._setDebugBounds(this._slotIndex, value);
  }

  setContent(content: string): void {
    if (this._destroyed) return;
    this._manager._setContent(this._slotIndex, content);
  }

  setFontSize(fontSize: number): void {
    if (this._destroyed) return;
    this._manager._setFontSize(this._slotIndex, fontSize);
  }

  setBold(bold: boolean): void {
    if (this._destroyed) return;
    this._manager._setBold(this._slotIndex, bold);
  }

  setItalic(italic: boolean): void {
    if (this._destroyed) return;
    this._manager._setItalic(this._slotIndex, italic);
  }

  setPosition(position: Vec3): void {
    if (this._destroyed) return;
    this._manager._setPosition(this._slotIndex, position);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._manager._destroySlot(this._slotIndex);
  }
}
