import { Engine, type FbxAssetHandle, type PubSubManager } from '@engine';
import { FBX_CATALOG } from '../items/fbx';
import { InputManager } from './managers/InputManager';
import { SpawnManager } from './managers/SpawnManager';
import { SelectionManager } from './managers/SelectionManager';
import { PhysicsManager } from './managers/PhysicsManager';
import { PlayStateManager } from './managers/PlayStateManager';
import { CameraController } from './controllers/CameraController';
import { GizmoController } from './controllers/GizmoController';
import { SaveLoadManager } from './managers/SaveLoadManager';
import {
  SANDBOX_EVENTS,
  type ItemSpawnPayload,
  type HierarchyObjectSelectedPayload,
  type HierarchyObjectRemovedPayload,
  type HierarchyObjectRenamedPayload,
  type SceneLoadRequestedPayload,
} from './events';

export class SceneManager {
  private readonly _canvas: HTMLCanvasElement;

  private _engine!:            Engine;
  private _pubSub!:            PubSubManager;
  private _inputManager!:      InputManager;
  private _spawnManager!:      SpawnManager;
  private _selectionManager!:  SelectionManager;
  private _physicsManager!:    PhysicsManager;
  private _playStateManager!:  PlayStateManager;
  private _cameraController!:  CameraController;
  private _gizmoController!:   GizmoController;
  private _saveLoadManager!:   SaveLoadManager;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
  }

  // ── Phase 1: create engine, return pubSub ─────────────────────────────────────

  async createEngine(): Promise<PubSubManager> {
    this._engine = await Engine.create(this._canvas);

    const camera = this._engine.createCamera({
      fovY:     Math.PI / 3,
      near:     0.1,
      far:      500,
      position: [0, 3, 8],
      yaw:      0,
      pitch:    Math.atan2(3, 8),
    });
    this._engine.setCamera(camera);
    this._pubSub = this._engine.PubSubManager;
    return this._pubSub;
  }

  // ── Phase 2: setup sub-managers (called after sections have subscribed) ───────

  async setup(): Promise<void> {
    const engine = this._engine;
    const pubSub = this._pubSub;

    const rawTextureUrls = import.meta.glob(
      '../../../assets/LowpolyForestPack/TreesTexture/*.png',
      { query: '?url', import: 'default', eager: true },
    ) as Record<string, string>;
    const textureOverrides: Record<string, string> = Object.fromEntries(
      Object.entries(rawTextureUrls).map(([path, url]) => [path.split('/').pop()!, url]),
    );

    pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Loading FBX assets...', level: 'log' });
    const fbxCache: Map<string, FbxAssetHandle> = new Map();
    await Promise.all(FBX_CATALOG.map(({ url }) =>
      engine.loadFbx(url, undefined, textureOverrides).then(handle => fbxCache.set(url, handle))
    ));
    pubSub.publish(SANDBOX_EVENTS.PROPERTY_PANEL_FBX_CATALOG, { catalog: FBX_CATALOG });

    engine.start();

    this._inputManager     = new InputManager(this._canvas, pubSub);
    this._spawnManager     = new SpawnManager(engine, fbxCache, pubSub);
    this._selectionManager = new SelectionManager(this._spawnManager, this._canvas, pubSub);
    this._physicsManager   = new PhysicsManager(engine, this._spawnManager, pubSub);
    this._playStateManager = new PlayStateManager(this._canvas, engine, this._spawnManager, this._physicsManager, pubSub);
    this._cameraController = new CameraController(engine, this._inputManager, () => this._playStateManager.isPlaying(), pubSub);
    this._gizmoController  = new GizmoController(
      engine,
      this._inputManager,
      this._selectionManager,
      this._spawnManager,
      () => this._playStateManager.isPlaying(),
      pubSub,
    );
    this._gizmoController.create();
    this._saveLoadManager = new SaveLoadManager(engine, this._spawnManager, this._physicsManager, pubSub);

    this._selectionManager.setPickingDisabled(() => this._playStateManager.isPlaying());
    this._selectionManager.setCameraDataGetter(() => engine.camera.getData());

    // Subscribe to UI events
    pubSub.subscribe(SANDBOX_EVENTS.TOOLBAR_PLAY, () => {
      this._playStateManager.play();
    });

    pubSub.subscribe(SANDBOX_EVENTS.TOOLBAR_STOP, () => {
      this._playStateManager.stop();
    });

    pubSub.subscribe(SANDBOX_EVENTS.TOOLBAR_SAVE, () => {
      this._saveLoadManager.saveScene().then(encodedString => {
        pubSub.publish(SANDBOX_EVENTS.SCENE_SAVED, { encodedString });
      });
    });

    pubSub.subscribe(SANDBOX_EVENTS.ITEM_SPAWN, (raw) => {
      const { key, entry } = raw as unknown as ItemSpawnPayload;
      this._spawnManager.spawn(key, entry);
    });

    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_OBJECT_SELECTED, (raw) => {
      const { index } = raw as unknown as HierarchyObjectSelectedPayload;
      this._selectionManager.select(index, this._playStateManager.isPlaying());
    });

    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_OBJECT_DESELECTED, () => {
      this._selectionManager.deselect();
    });

    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_OBJECT_REMOVED, (raw) => {
      const { index } = raw as unknown as HierarchyObjectRemovedPayload;
      this._spawnManager.removeObject(index);
    });

    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_OBJECT_RENAMED, (raw) => {
      const { index, name } = raw as unknown as HierarchyObjectRenamedPayload;
      this._spawnManager.renameObject(index, name);
    });

    pubSub.subscribe(SANDBOX_EVENTS.SCENE_LOAD_REQUESTED, async (raw) => {
      const { encodedString } = raw as unknown as SceneLoadRequestedPayload;
      if (this._playStateManager.isPlaying()) this._playStateManager.stop();
      this._selectionManager.deselect();
      const success = await this._saveLoadManager.loadScene(encodedString);
      pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, success
        ? { message: 'Scene loaded successfully.', level: 'log' }
        : { message: 'Failed to load scene — invalid or corrupted data.', level: 'error' }
      );
    });

    pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Engine initialised.', level: 'log' });
    pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Press Play to start | Click an object to inspect it.', level: 'log' });
    pubSub.publish(SANDBOX_EVENTS.ENGINE_INITIALIZED);
  }

  // ── Frame loop ────────────────────────────────────────────────────────────────

  startLoop(): void {
    this._engine.onFrame((deltaTime: number) => {
      const isPlaying = this._playStateManager.isPlaying();
      const isDraggingAxis = this._gizmoController.isDragging();

      this._cameraController.tick(deltaTime);

      const [deltaX, deltaY] = this._inputManager.readMouseDelta();
      if (isDraggingAxis && !isPlaying) {
        this._gizmoController.applyDrag();
      } else if (this._inputManager.isMouseButtonDown() && !isPlaying) {
        this._cameraController.applyMouseRotation(deltaX, deltaY);
      } else if (document.pointerLockElement === this._canvas) {
        this._cameraController.applyPointerLockRotation(deltaX, deltaY);
      }
      this._inputManager.clearMouseDelta();

      this._gizmoController.sync();

      if (isPlaying) {
        this._playStateManager.tick(deltaTime);
        this._physicsManager.tick(deltaTime);
      }
    });
  }
}
