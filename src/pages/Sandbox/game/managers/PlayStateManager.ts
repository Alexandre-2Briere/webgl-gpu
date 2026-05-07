import { Engine, LightGameObject, type IGameObject } from '@engine';
import type { SpawnManager } from './SpawnManager';
import type { PhysicsManager } from './PhysicsManager';
import type { InputManager } from './InputManager';
import { SANDBOX_EVENTS, type PubSubManager } from '../events';
import type { GameScript, GameScriptConstructor } from '../scripts/ScriptContract';
import { CameraScript } from '../scripts/CameraScript';
import { getParamNames } from '../utils/functionParser';

const SCRIPT_LOADERS = import.meta.glob<{ default: GameScriptConstructor }>('../scripts/*.ts');

function _findLoader(scriptName: string): (() => Promise<{ default: GameScriptConstructor }>) | null {
  const entry = Object.entries(SCRIPT_LOADERS).find(
    ([path]) => !path.includes('ScriptContract') && !path.includes('CameraScript') && path.endsWith(`/${scriptName}.ts`),
  );
  return entry ? entry[1] : null;
}

export class PlayStateManager {
  private readonly _canvas:          HTMLCanvasElement;
  private readonly _engine:          Engine;
  private readonly _spawnManager:    SpawnManager;
  private readonly _physicsManager:  PhysicsManager;
  private readonly _inputManager:    InputManager;
  private readonly _pubSub:          PubSubManager;

  private _playing       = false;
  private _cameraScript: CameraScript | null = null;

  constructor(
    canvas:         HTMLCanvasElement,
    engine:         Engine,
    spawnManager:   SpawnManager,
    physicsManager: PhysicsManager,
    inputManager:   InputManager,
    pubSub:         PubSubManager,
  ) {
    this._canvas         = canvas;
    this._engine         = engine;
    this._spawnManager   = spawnManager;
    this._physicsManager = physicsManager;
    this._inputManager   = inputManager;
    this._pubSub         = pubSub;

    pubSub.subscribe(SANDBOX_EVENTS.INPUT_POINTER_LOCK_RELEASED, () => {
      this.stop();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    if (this._playing) return;

    for (const spawnedObject of this._spawnManager.getObjects()) {
      const position = spawnedObject.gameObject.position;
      spawnedObject.playSnapshot = [position[0], position[1], position[2]];
    }

    this._canvas.requestPointerLock();
    this._playing = true;

    this._cameraScript = new CameraScript(this._inputManager);
    await this._cameraScript.execute(this._engine);

    for (const spawnedObject of this._spawnManager.getObjects()) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(false);
      }

      if (spawnedObject.key === 'ScriptObject') {
        (spawnedObject.gameObject as IGameObject).renderable.visible = false;

        if (spawnedObject.selectedScript) {
          const loader = _findLoader(spawnedObject.selectedScript);
          if (loader) {
            const engine = this._engine;
            const scriptArgs = spawnedObject.selectedScriptArgs;
            loader()
              .then(module => {
                const Ctor     = module.default;
                const params   = getParamNames(Ctor.prototype.execute).filter(p => p !== 'engine');
                const args     = params.map(p => scriptArgs[p] ?? 0);
                const instance: GameScript = new Ctor();
                spawnedObject.scriptHandle = instance;
                return instance.execute(engine, ...args);
              })
              .catch((error: unknown) => {
                this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, {
                  message: `Script error (${spawnedObject.selectedScript}): ${String(error)}`,
                  level: 'error',
                });
              });
          }
        }
      }
    }

    this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Play started.', level: 'log' });
    this._pubSub.publish(SANDBOX_EVENTS.PLAY_STARTED);
  }

  stop(): void {
    if (!this._playing) return;

    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock();
    }

    this._cameraScript?.destroy();
    this._cameraScript = null;
    this._physicsManager.resetToSnapshots();
    this._playing = false;

    for (const spawnedObject of this._spawnManager.getObjects()) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(true);
      }

      if (spawnedObject.key === 'ScriptObject') {
        (spawnedObject.gameObject as IGameObject).renderable.visible = true;

        if (spawnedObject.scriptHandle) {
          spawnedObject.scriptHandle.destroy();
          spawnedObject.scriptHandle = null;
        }
      }
    }

    this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Play stopped.', level: 'log' });
    this._pubSub.publish(SANDBOX_EVENTS.PLAY_STOPPED);
  }

  tick(deltaTime: number, mouseDeltaX: number, mouseDeltaY: number): void {
    this._cameraScript?.receiveMouseDelta(mouseDeltaX, mouseDeltaY);
    this._cameraScript?.update(deltaTime);

    for (const spawnedObject of this._spawnManager.getObjects()) {
      const instance = spawnedObject.scriptHandle;
      if (!instance) continue;
      const proto  = Object.getPrototypeOf(instance) as { update: (...args: unknown[]) => void };
      const params = getParamNames(proto.update).filter(p => p !== 'deltaTime_number');
      const args   = params.map(p => spawnedObject.selectedScriptArgs[p] ?? 0);
      instance.update(deltaTime, ...args);
    }
  }

  isPlaying(): boolean {
    return this._playing;
  }
}
