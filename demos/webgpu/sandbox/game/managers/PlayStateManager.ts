import { LightGameObject } from '../../../../../src/webgpu/engine/gameObject/LightGameObject';
import type { SpawnManager } from './SpawnManager';
import type { PhysicsManager } from './PhysicsManager';
import type { Terminal } from '../../ui/Terminal/Terminal';
import { SANDBOX_EVENTS } from '../events';
import type { PubSubManager } from '../events';

export class PlayStateManager {
  private readonly _canvas:          HTMLCanvasElement;
  private readonly _spawnManager:    SpawnManager;
  private readonly _physicsManager:  PhysicsManager;
  private readonly _terminal:        Terminal;
  private readonly _pubSub:          PubSubManager;

  private _playing = false;

  constructor(
    canvas:         HTMLCanvasElement,
    spawnManager:   SpawnManager,
    physicsManager: PhysicsManager,
    terminal:       Terminal,
    pubSub:         PubSubManager,
  ) {
    this._canvas         = canvas;
    this._spawnManager   = spawnManager;
    this._physicsManager = physicsManager;
    this._terminal       = terminal;
    this._pubSub         = pubSub;

    pubSub.subscribe(SANDBOX_EVENTS.INPUT_POINTER_LOCK_RELEASED, () => {
      this.stop();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  play(): void {
    if (this._playing) return;

    for (const spawnedObject of this._spawnManager.getObjects()) {
      const position = spawnedObject.gameObject.position;
      spawnedObject.playSnapshot = [position[0], position[1], position[2]];
    }

    this._canvas.requestPointerLock();
    this._playing = true;

    for (const spawnedObject of this._spawnManager.getObjects()) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(false);
      }
    }

    this._terminal.print('Play started.', 'log');
    this._pubSub.publish(SANDBOX_EVENTS.PLAY_STARTED);
  }

  stop(): void {
    if (!this._playing) return;

    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock();
    }

    this._physicsManager.resetToSnapshots();
    this._playing = false;

    for (const spawnedObject of this._spawnManager.getObjects()) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(true);
      }
    }

    this._terminal.print('Play stopped.', 'log');
    this._pubSub.publish(SANDBOX_EVENTS.PLAY_STOPPED);
  }

  isPlaying(): boolean {
    return this._playing;
  }
}
