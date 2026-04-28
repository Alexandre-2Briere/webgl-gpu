import type {
  EngineOptions,
  BindGroupLayouts,
  GameObjectBaseOptions,
  MeshGameObjectOptions,
  CubeGameObjectOptions,
  Quad2DGameObjectOptions,
  Quad3DGameObjectOptions,
  Model3DGameObjectOptions,
  FbxModelGameObjectOptions,
  ModelAssetHandle,
  FbxAssetHandle,
  CameraOptions,
  PointLightOptions,
  AmbientLightOptions,
  DirectionalLightOptions,
  ArrowGizmoOptions,
  SkyboxOptions,
  InfiniteGroundOptions,
  Bar3DOptions,
} from './types';
import { Renderer } from './core/Renderer';
import { Scene } from './core/Scene';
import { PipelineCache } from './core/PipelineCache';
import { UniformPool } from './buffers/UniformPool';
import { LightBuffer } from './buffers/LightBuffer';
import { Mesh } from './gameObject/3D/renderables/Mesh';
import { Quad2D } from './gameObject/3D/renderables/Quad2D';
import { Quad3D } from './gameObject/3D/renderables/Quad3D';
import { Model3D } from './gameObject/3D/renderables/Model3D';
import { FbxModel } from './gameObject/3D/renderables/FbxModel';
import { ArrowGizmo } from './gameObject/3D/renderables/ArrowGizmo';
import type { Renderable, RenderableInitArgs } from './gameObject/3D/renderables/Renderable';
import { loadObjAsset, loadFbxAsset } from './utils/assetLoaders';
import { buildCubeVertices } from './utils/buildCubeVertices';
import { createEngineLayouts } from './utils/bindGroupLayouts';
import { GameObject } from './gameObject/3D/3DGameObject';
import type { IGameObject } from './gameObject/3D/3DGameObject';
import { LightGameObject, LightType } from './gameObject/Light/LightGameObject';
import { SkyboxGameObject } from './gameObject/Unique/SkyboxGameObject';
import { SkyboxRenderable } from './gameObject/3D/renderables/SkyboxRenderable';
import { InfiniteGroundGameObject } from './gameObject/Unique/InfiniteGroundGameObject';
import { InfiniteGroundRenderable } from './gameObject/3D/renderables/InfiniteGroundRenderable';
import { Rigidbody3D } from './gameObject/3D/rigidbody/Rigidbody3D';
import type { Hitbox3D } from './gameObject/3D/hitbox/Hitbox3D';
import { SaveManager } from './saveManager/SaveManager';
import { restoreFromSnapshot } from './saveManager/restoreScene';
import { PubSubManager } from './core/PubSub';
import { Bar3DManager } from './gameObject/3D/renderables/Bar3DManager';
import type { Bar3DHandle } from './gameObject/UI/Bar3DHandle';
import { Camera } from './core/Camera';
import { logger } from './utils/logger';
import { UIGameObject } from './gameObject/UI/UIGameObject';

/** Initial chunk size for the UniformPool. Grows automatically when exceeded. */
const INITIAL_CHUNK_SIZE = 512 * 256;

/**
 * Top-level WebGPU engine facade.
 *
 * Obtain an instance via the async factory `Engine.create(canvas)`.
 * Call `setCamera()` before `start()` — the render loop needs a valid camera
 * to compute the view-projection matrix each frame.
 *
 * Lifecycle:
 * ```
 * const engine = await Engine.create(canvas);
 * const camera = engine.createCamera({ position: [0, 5, 10] });
 * engine.setCamera(camera);
 * engine.onFrame(dt => { … });
 * engine.start();
 * // later:
 * engine.destroy();
 * ```
 */
export class Engine {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _renderer: Renderer;
  private readonly _scene: Scene;
  private readonly _pipelineCache: PipelineCache;
  private readonly _uniformPool: UniformPool;
  private readonly _lightBuffer: LightBuffer;
  private readonly _layouts: BindGroupLayouts;
  private _camera: Camera;
  private _rafHandle = 0;
  private _onFrame: ((deltaTime: number) => void) | null = null;
  private _referenceFovX = 0;
  private _previousAspect = 0;
  private _skybox: SkyboxGameObject | null = null;
  private _infiniteGround: InfiniteGroundGameObject | null = null;
  private _bar3DManager: Bar3DManager | null = null;
  public readonly PubSubManager: PubSubManager;

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    pipelineCache: PipelineCache,
    uniformPool: UniformPool,
    lightBuffer: LightBuffer,
    layouts: BindGroupLayouts,
    camera: Camera,
  ) {
    this._canvas = canvas;
    this._renderer = renderer;
    this._scene = new Scene(renderer, lightBuffer);
    this._pipelineCache = pipelineCache;
    this._uniformPool = uniformPool;
    this._lightBuffer = lightBuffer;
    this._layouts = layouts;
    this._camera = camera;
    this.PubSubManager = new PubSubManager();
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Async factory — the only way to instantiate `Engine`.
   * Requests a GPU adapter + device, creates all shared GPU resources
   * (renderer, pipeline cache, uniform pool, light buffer, bind group layouts),
   * and registers a device-lost handler that stops the render loop.
   * @throws If WebGPU is unavailable or no suitable adapter is found.
   */
  static async create(canvas: HTMLCanvasElement, opts: EngineOptions = {}): Promise<Engine> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: opts.powerPreference ?? 'high-performance',
    });
    if (!adapter) throw new Error('No suitable GPU adapter found.');

    const device = await adapter.requestDevice({
      label: 'engine-device',
    });

    const renderer = new Renderer(device, canvas);
    const pipelineCache = new PipelineCache(device);
    const uniformPool = new UniformPool(device, INITIAL_CHUNK_SIZE);
    const layouts = createEngineLayouts(device);
    const lightBuffer = new LightBuffer(device, layouts.lights);
    const camera = new Camera(device, layouts.camera, {});

    const engine = new Engine(canvas, renderer, pipelineCache, uniformPool, lightBuffer, layouts, camera);

    device.lost.then(info => {
      logger.error('WebGPU device lost:', info.message);
      engine.stop();
    });

    return engine;
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  /**
   * Swaps the active camera. The previous camera is destroyed (its GPU uniform
   * buffer is released). Call this before or after `start()` — the new camera
   * takes effect on the next rendered frame.
   */
  setCamera(camera: Camera): void {
    this._camera?.destroy();
    this._camera = camera;
    this._previousAspect = 0;
  }

  get camera(): Camera { return this._camera; }

  // ── GameObject factory methods ───────────────────────────────────────────────

  createMesh(opts: MeshGameObjectOptions): GameObject<Mesh> {
    return this._spawnGameObject(new Mesh(opts.renderable), opts);
  }

  createCube(opts: CubeGameObjectOptions = {}): GameObject<Mesh> {
    const { vertices, indices } = buildCubeVertices(opts.color ?? [1, 1, 1, 1]);
    return this._spawnGameObject(new Mesh({ vertices, indices, label: opts.label ?? 'cube' }), opts);
  }

  createQuad2D(opts: Quad2DGameObjectOptions): GameObject<Quad2D> {
    return this._spawnGameObject(new Quad2D(opts.renderable), opts);
  }

  createQuad3D(opts: Quad3DGameObjectOptions): GameObject<Quad3D> {
    return this._spawnGameObject(new Quad3D(opts.renderable), opts);
  }

  createModelObj(opts: Model3DGameObjectOptions): GameObject<Model3D> {
    return this._spawnGameObject(new Model3D(opts.renderable), opts);
  }

  createFbxModel(opts: FbxModelGameObjectOptions): GameObject<FbxModel> {
    return this._spawnGameObject(new FbxModel(opts.renderable), opts);
  }

  createArrowGizmo(opts: ArrowGizmoOptions = {}): ArrowGizmo {
    const gizmo = new ArrowGizmo(opts);
    gizmo.init(this._initArgs());
    this._scene.add(gizmo);
    return gizmo;
  }

  destroyArrowGizmo(gizmo: ArrowGizmo): void {
    this._scene.remove(gizmo);
    gizmo.destroy();
  }

  // ── Light factory methods ────────────────────────────────────────────────────

  createPointLight(opts: PointLightOptions = {}): LightGameObject {
    const light = new LightGameObject({
      lightType:   LightType.Point,
      color:       opts.color,
      radius:      opts.radius,
      lightBuffer: this._lightBuffer,
      _destroy:    () => this._lightBuffer.removeLight(light),
    });
    this._lightBuffer.addLight(light);
    this._spawnLightRenderable(light);
    return light;
  }

  createAmbientLight(opts: AmbientLightOptions = {}): LightGameObject {
    const light = new LightGameObject({
      lightType:   LightType.Ambient,
      color:       opts.color,
      radius:      opts.strength ?? 1.0,
      lightBuffer: this._lightBuffer,
      _destroy:    () => this._lightBuffer.removeLight(light),
    });
    this._lightBuffer.addLight(light);
    this._spawnLightRenderable(light);
    return light;
  }

  createDirectionalLight(opts: DirectionalLightOptions = {}): LightGameObject {
    const light = new LightGameObject({
      lightType:   LightType.Directional,
      color:       opts.color,
      radius:      opts.power ?? 1.0,
      lightBuffer: this._lightBuffer,
      _destroy:    () => this._lightBuffer.removeLight(light),
    });
    light.setDirection(opts.direction ?? [0.577, 0.577, 0.577]);
    this._lightBuffer.addLight(light);
    this._spawnLightRenderable(light);
    return light;
  }

  private _spawnLightRenderable(light: LightGameObject): void {
    light.initRenderable(this._initArgs(), this._scene);
  }

  // ── Skybox factory ───────────────────────────────────────────────────────────

  createSkybox(opts: SkyboxOptions = {}): SkyboxGameObject {
    if (this._skybox !== null) {
      logger.error('Engine.createSkybox: a Skybox already exists; destroy it first.');
      throw new Error('Engine: only one Skybox is allowed per Engine instance.');
    }
    const renderable = new SkyboxRenderable(opts.color);
    renderable.init(this._initArgs());
    this._scene.setSkybox(renderable);
    this._skybox = new SkyboxGameObject({
      renderable,
      scene: this._scene,
      _destroy: () => { this._skybox = null; },
    });
    return this._skybox;
  }

  destroySkybox(): void {
    this._skybox?.destroy();
  }

  // ── InfiniteGround factory ───────────────────────────────────────────────────

  createInfiniteGround(opts: InfiniteGroundOptions = {}): InfiniteGroundGameObject {
    if (this._infiniteGround !== null) {
      logger.error('Engine.createInfiniteGround: an InfiniteGround already exists; destroy it first.');
      throw new Error('Engine: only one InfiniteGround is allowed per Engine instance.');
    }
    const renderable = new InfiniteGroundRenderable(opts);
    renderable.init(this._initArgs());
    this._scene.add(renderable);
    this._infiniteGround = new InfiniteGroundGameObject({
      renderable,
      scene: this._scene,
      yLevel: opts.yLevel,
      _destroy: () => { this._infiniteGround = null; },
    });
    return this._infiniteGround;
  }

  destroyInfiniteGround(): void {
    this._infiniteGround?.destroy();
  }

  // ── Bar3D factory ────────────────────────────────────────────────────────────

  /**
   * Creates a world-space Y-axis-billboard progress bar.
   * The shared `Bar3DManager` (a GPU instanced renderable) is lazily initialised
   * on the first call and added to the scene once; subsequent calls allocate a
   * new slot in the existing instance buffer.
   */
  createBar3D(opts: Bar3DOptions): UIGameObject<Bar3DHandle> {
    if (this._bar3DManager === null) {
      this._bar3DManager = new Bar3DManager();
      this._bar3DManager.init(this._initArgs());
      this._scene.add(this._bar3DManager);
    }
    const handle = this._bar3DManager.spawn(opts);
    return new UIGameObject<Bar3DHandle>(handle);;
  }

  // ── Asset loaders ────────────────────────────────────────────────────────────

  /**
   * Fetches and parses a Wavefront OBJ file, uploading the resulting vertex and
   * index data to the GPU. Returns a `ModelAssetHandle` that can be reused by
   * multiple `createModelObj()` calls. Call `handle.destroy()` when done.
   * @param timeoutMs Fetch timeout in ms (default: 10 000).
   */
  async loadObj(url: string, timeoutMs?: number): Promise<ModelAssetHandle> {
    return loadObjAsset(this._renderer.device, this._renderer.queue, url, timeoutMs);
  }

  /**
   * Fetches and parses an FBX file (binary or ASCII), uploads all mesh slices
   * and their textures to the GPU. Returns an `FbxAssetHandle` reusable across
   * multiple `createFbxModel()` calls. Call `handle.destroy()` when done.
   * @param textureOverrides Map of embedded texture path → replacement URL,
   *   used to swap in external textures when embedded ones are absent or wrong.
   * @param timeoutMs Fetch timeout in ms (default: 10 000).
   */
  async loadFbx(
    url: string,
    timeoutMs?: number,
    textureOverrides: Record<string, string> = {},
  ): Promise<FbxAssetHandle> {
    return loadFbxAsset(this._renderer.device, this._renderer.queue, this._layouts.fbxMaterial, url, timeoutMs, textureOverrides);
  }

  createCamera(opts: CameraOptions = {}): Camera {
    return new Camera(this._renderer.device, this._layouts.camera, opts);
  }

  /**
   * Deserialises a save string produced by `SaveManager.save()` and restores
   * the full scene state (game objects, lights, camera, skybox, ground).
   * @throws If the save string is invalid, corrupt, or decompression fails.
   */
  async loadScene(saveString: string): Promise<void> {
    const segments = await new SaveManager().load(saveString);
    if (segments === null) throw new Error('[Engine] loadScene: invalid or corrupt save string');
    await restoreFromSnapshot(this, segments);
  }

  // ── RAF loop ────────────────────────────────────────────────────────────────

  /**
   * Registers a per-frame callback invoked at the start of each RAF tick,
   * before the render pass. `deltaTime` is in seconds, capped at 0.1 s to
   * prevent large jumps after tab-visibility changes.
   */
  onFrame(callback: (deltaTime: number) => void): void {
    this._onFrame = callback;
  }

  /** Starts the RAF render loop. No-op if already running. */
  start(): void {
    if (this._rafHandle !== 0) return;
    let lastTimestamp = performance.now();
    const loop = (timestamp: number) => {
      this._rafHandle = requestAnimationFrame(loop);
      const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;
      this._onFrame?.(deltaTime);
      this._compensateCameraForAspectChange();
      this._scene.frame(this._camera, this._canvas);
    };
    this._rafHandle = requestAnimationFrame(loop);
  }

  /**
   * Adjusts camera fovY each frame to preserve horizontal FOV when the canvas
   * aspect ratio changes. Without this, resizing any panel causes objects to
   * appear to shift horizontally as the projection X-scale changes.
   *
   * Strategy: lock horizontal FOV (fovX) as the invariant.
   *   fovX = 2 * atan(tan(fovY/2) * aspect)
   * When aspect changes, recompute fovY = 2 * atan(tan(fovX/2) / aspect).
   */
  private _compensateCameraForAspectChange(): void {
    const currentAspect = this._canvas.width / this._canvas.height;
    if (!isFinite(currentAspect) || currentAspect <= 0) return;

    if (this._previousAspect === 0) {
      this._referenceFovX = 2 * Math.atan(Math.tan(this._camera.fovY * 0.5) * currentAspect);
      this._previousAspect = currentAspect;
      return;
    }

    if (currentAspect === this._previousAspect) return;

    this._camera.fovY = 2 * Math.atan(Math.tan(this._referenceFovX * 0.5) / currentAspect);
    this._previousAspect = currentAspect;
  }

  /** Cancels the RAF loop. GPU resources remain alive; call `start()` to resume. */
  stop(): void {
    if (this._rafHandle !== 0) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = 0;
    }
  }

  /**
   * Stops the render loop and releases all shared GPU resources (scene,
   * camera, uniform pool, light buffer). Do not use the engine after calling this.
   */
  destroy(): void {
    this.stop();
    this._scene.destroy();
    this._camera.destroy();
    this._uniformPool.destroy();
    this._lightBuffer.destroy();
  }

  // ── Escape hatches ──────────────────────────────────────────────────────────

  get device(): GPUDevice { return this._renderer.device; }
  get canvas(): HTMLCanvasElement { return this._canvas; }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Initialises a renderable, adds it to the scene, and wraps it in a
   * `GameObject` with `_destroy` and `_copy` closures wired to the scene and
   * this engine's pool.
   */
  private _spawnGameObject<R extends Renderable>(
    renderable: R,
    goOpts: GameObjectBaseOptions,
  ): GameObject<R> {
    renderable.init(this._initArgs());
    this._scene.add(renderable);

    // eslint-disable-next-line prefer-const
    let go!: GameObject<R>;

    const _destroy = (): void => {
      this._scene.remove(renderable);
      renderable.destroy();
    };

    const _copy = (): IGameObject<R> => {
      const r2 = renderable.clone() as R;
      const h2 = go.hitbox?.clone();
      const rb2 = go.rigidbody ? this._cloneRigidbody(go.rigidbody, h2) : undefined;
      return this._spawnGameObject(r2, {
        position:   [...go.position] as [number, number, number],
        quaternion: [...go.quaternion] as [number, number, number, number],
        scale:      [...go.scale] as [number, number, number],
        hitbox:     h2,
        rigidbody:  rb2,
      });
    };

    go = new GameObject<R>({
      renderable,
      position:        goOpts.position,
      quaternion:      goOpts.quaternion,
      scale:           goOpts.scale,
      hitbox:          goOpts.hitbox,
      rigidbody:       goOpts.rigidbody,
      rigidbodyOffset: goOpts.rigidbodyOffset,
      _copy,
      _destroy,
    });

    return go;
  }

  private _cloneRigidbody(rb: Rigidbody3D, hitbox?: Hitbox3D): Rigidbody3D {
    return new Rigidbody3D({
      layer:      rb.layer,
      isStatic:   rb.isStatic,
      mass:       rb.mass,
      useGravity: rb.useGravity,
      hitbox:     hitbox ?? rb.hitbox?.clone() ?? undefined,
    });
  }

  private _initArgs(): RenderableInitArgs {
    return {
      device: this._renderer.device,
      queue: this._renderer.queue,
      format: this._renderer.format,
      pipelineCache: this._pipelineCache,
      layouts: this._layouts,
      uniformPool: this._uniformPool,
    };
  }
}
