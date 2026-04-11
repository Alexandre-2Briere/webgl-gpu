import { Engine } from '../../../../src/webgpu/engine/index';
import type { FbxAssetHandle } from '../../../../src/webgpu/engine/index';
import type { Terminal } from '../ui/Terminal/Terminal';
import type { PropertyPanel } from '../ui/PropertyPanel/PropertyPanel';
import type { SceneHierarchy } from '../ui/SceneHierarchy/SceneHierarchy';
import type { ItemEntry } from '../items/types';
import { FBX_CATALOG } from '../items/fbx';
import { InputManager } from './managers/InputManager';
import { SpawnManager } from './managers/SpawnManager';
import { SelectionManager } from './managers/SelectionManager';
import { PhysicsManager } from './managers/PhysicsManager';
import { PlayStateManager } from './managers/PlayStateManager';
import { CameraController } from './controllers/CameraController';
import { GizmoController } from './controllers/GizmoController';
import { SaveLoadManager } from './managers/SaveLoadManager';

export class SceneManager {
  private readonly _canvas:          HTMLCanvasElement;
  private readonly _terminal:        Terminal;
  private readonly _propertyPanel:   PropertyPanel;
  private readonly _sceneHierarchy:  SceneHierarchy;

  private _engine!:            Engine;
  private _inputManager!:      InputManager;
  private _spawnManager!:      SpawnManager;
  private _selectionManager!:  SelectionManager;
  private _physicsManager!:    PhysicsManager;
  private _playStateManager!:  PlayStateManager;
  private _cameraController!:  CameraController;
  private _gizmoController!:   GizmoController;
  private _saveLoadManager!:   SaveLoadManager;

  constructor(
    canvas:         HTMLCanvasElement,
    terminal:       Terminal,
    propertyPanel:  PropertyPanel,
    sceneHierarchy: SceneHierarchy,
  ) {
    this._canvas         = canvas;
    this._terminal       = terminal;
    this._propertyPanel  = propertyPanel;
    this._sceneHierarchy = sceneHierarchy;
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this._engine = await Engine.create(this._canvas);
    const engine = this._engine;

    const camera = engine.createCamera({
      fovY:     Math.PI / 3,
      near:     0.1,
      far:      500,
      position: [0, 3, 8],
      yaw:      0,
      pitch:    Math.atan2(3, 8),
    });
    engine.setCamera(camera);

    this._terminal.print('Loading FBX assets...', 'log');
    const fbxCache: Map<string, FbxAssetHandle> = new Map();
    await Promise.all(FBX_CATALOG.map(({ url }) =>
      engine.loadFbx(url).then(handle => fbxCache.set(url, handle))
    ));
    this._propertyPanel.setFbxCatalog(FBX_CATALOG);

    engine.start();

    engine.createDirectionalLight({
      direction: [0.577, 0.577, 0.577],
      color:     [0.35, 0.35, 0.35],
      power:     1.0,
    });

    // Construct managers and controllers
    this._inputManager     = new InputManager(this._canvas);
    this._spawnManager     = new SpawnManager(engine, this._terminal, this._propertyPanel, this._sceneHierarchy, fbxCache);
    this._selectionManager = new SelectionManager(this._spawnManager, this._propertyPanel, this._sceneHierarchy, this._canvas);
    this._physicsManager   = new PhysicsManager(engine, this._spawnManager);
    this._playStateManager = new PlayStateManager(this._canvas, this._spawnManager, this._physicsManager, this._terminal);
    this._cameraController = new CameraController(engine, this._inputManager, () => this._playStateManager.isPlaying());
    this._gizmoController  = new GizmoController(
      engine,
      this._inputManager,
      this._selectionManager,
      this._spawnManager,
      this._propertyPanel,
      () => this._playStateManager.isPlaying(),
    );
    this._gizmoController.create();
    this._saveLoadManager = new SaveLoadManager(engine, this._spawnManager, this._physicsManager, this._terminal);

    // Wire SelectionManager with play-state context for picking
    this._selectionManager.setPickingDisabled(() => this._playStateManager.isPlaying());
    this._selectionManager.setCameraDataGetter(() => engine.camera.getData());

    // Wire PropertyPanel physics callbacks into PhysicsManager
    this._physicsManager.wirePropertyPanel(this._propertyPanel);

    // Pointer lock release → stop play
    this._inputManager.onPointerLockReleased = () => {
      if (this._playStateManager.isPlaying()) {
        this._playStateManager.stop();
        this._gizmoController.sync();
        document.dispatchEvent(new CustomEvent('sandbox:stopped'));
      }
    };

    this._terminal.print('Engine initialised.', 'log');
    this._terminal.print('Press Play to start | Click an object to inspect it.', 'log');
  }

  // ── Frame loop ────────────────────────────────────────────────────────────────

  startLoop(): void {
    this._engine.onFrame((deltaTime: number) => {
      const isPlaying = this._playStateManager.isPlaying();
      const isDraggingAxis = this._gizmoController.isDragging();

      // Camera keyboard movement (WASD / Q / E / Space / Shift — only when playing)
      this._cameraController.tick(deltaTime);

      // Mouse delta: axis drag takes priority over camera rotation
      const [deltaX, deltaY] = this._inputManager.readMouseDelta();
      if (isDraggingAxis && !isPlaying) {
        this._gizmoController.applyDrag();
      } else if (this._inputManager.isMouseButtonDown() && !isPlaying) {
        this._cameraController.applyMouseRotation(deltaX, deltaY);
      } else if (document.pointerLockElement === this._canvas) {
        this._cameraController.applyPointerLockRotation(deltaX, deltaY);
      }
      this._inputManager.clearMouseDelta();

      // Gizmo position sync with selected object
      this._gizmoController.sync();

      // Physics (only when playing)
      if (isPlaying) {
        this._physicsManager.tick(deltaTime);
      }
    });
  }

  // ── Public API (delegated to managers) ───────────────────────────────────────

  play(): void {
    this._playStateManager.play();
    this._selectionManager.deselect();
  }

  stop(): void {
    this._playStateManager.stop();
  }

  isPlaying(): boolean {
    return this._playStateManager.isPlaying();
  }

  spawn(key: string, entry: ItemEntry): void {
    this._spawnManager.spawn(key, entry);
  }

  selectObject(index: number): void {
    this._selectionManager.select(index, this._playStateManager.isPlaying());
  }

  deselectObject(): void {
    this._selectionManager.deselect();
  }

  renameObject(index: number, newName: string): boolean {
    return this._spawnManager.renameObject(index, newName);
  }

  removeObject(index: number): void {
    const newSelectedIndex = this._spawnManager.removeObject(index, this._selectionManager.getSelectedIndex());
    if (newSelectedIndex !== this._selectionManager.getSelectedIndex()) {
      if (newSelectedIndex === -1 && this._gizmoController.getGizmo()) {
        const gizmo = this._gizmoController.getGizmo()!;
        gizmo.visible = false;
      }
      this._selectionManager.updateSelectedIndex(newSelectedIndex);
    }
  }

  async saveScene(): Promise<string> {
    return this._saveLoadManager.saveScene();
  }

  async loadScene(encodedString: string): Promise<boolean> {
    if (this._playStateManager.isPlaying()) {
      this._playStateManager.stop();
      this._gizmoController.sync();
    }
    this._selectionManager.deselect();
    return this._saveLoadManager.loadScene(encodedString);
  }

}
