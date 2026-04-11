export class InputManager {
  private readonly _canvas:    HTMLCanvasElement;
  private readonly _pressedKeys = new Set<string>();
  private _mouseButtonDown = false;
  private _mouseDeltaX     = 0;
  private _mouseDeltaY     = 0;

  onPointerLockReleased: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._attach();
  }

  // ── Read state ────────────────────────────────────────────────────────────────

  isKeyDown(code: string): boolean {
    return this._pressedKeys.has(code);
  }

  isMouseButtonDown(): boolean {
    return this._mouseButtonDown;
  }

  readMouseDelta(): [number, number] {
    return [this._mouseDeltaX, this._mouseDeltaY];
  }

  clearMouseDelta(): void {
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────────

  private _attach(): void {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      this._pressedKeys.add(event.code);
    });

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      this._pressedKeys.delete(event.code);
    });

    window.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button === 0) this._mouseButtonDown = true;
    });

    window.addEventListener('mouseup', (event: MouseEvent) => {
      if (event.button === 0) this._mouseButtonDown = false;
    });

    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (document.pointerLockElement === this._canvas || this._mouseButtonDown) {
        this._mouseDeltaX += event.movementX;
        this._mouseDeltaY += event.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this._canvas) {
        this.onPointerLockReleased?.();
      }
    });
  }
}
