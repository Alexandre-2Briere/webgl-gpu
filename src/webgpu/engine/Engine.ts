import type {
  EngineOptions,
  BindGroupLayouts,
  MeshOptions, MeshHandle,
  ComputedMeshOptions, ComputedRenderableHandle,
  Quad2DOptions, Quad2DHandle,
  Quad3DOptions, Quad3DHandle,
  Model3DOptions, Model3DHandle, ModelAssetHandle,
  FbxModelOptions, FbxModelHandle, FbxAssetHandle,
  CameraOptions,
} from './types'
import { Camera, Renderer, Scene, PipelineCache } from './core'
import { UniformPool } from './buffers'
import { Mesh, Quad2D, Quad3D, ComputedRenderable, Model3D, FbxModel } from './renderables'
import type { RenderableInitArgs } from './renderables'
import { parseObj, parseFbx } from './loaders'
import { ModelAsset } from './ModelAsset'
import { FbxAsset } from './FbxAsset'

/** Pool size for per-object uniforms: supports up to 512 renderables. */
const UNIFORM_POOL_SIZE = 512 * 256

/** Maximum asset download size (256 MB). Enforced both on Content-Length and during streaming. */
const MAX_ASSET_BYTES = 256 * 1024 * 1024

export class Engine {
  private readonly _canvas: HTMLCanvasElement
  private readonly _renderer: Renderer
  private readonly _scene: Scene
  private readonly _pipelineCache: PipelineCache
  private readonly _uniformPool: UniformPool
  private readonly _layouts: BindGroupLayouts
  private _camera: Camera
  private _rafHandle = 0

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    pipelineCache: PipelineCache,
    uniformPool: UniformPool,
    layouts: BindGroupLayouts,
    camera: Camera,
  ) {
    this._canvas = canvas
    this._renderer = renderer
    this._scene = new Scene(renderer)
    this._pipelineCache = pipelineCache
    this._uniformPool = uniformPool
    this._layouts = layouts
    this._camera = camera
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  static async create(canvas: HTMLCanvasElement, opts: EngineOptions = {}): Promise<Engine> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser.')
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: opts.powerPreference ?? 'high-performance',
    })
    if (!adapter) throw new Error('No suitable GPU adapter found.')

    const device = await adapter.requestDevice({
      label: 'engine-device',
    })

    device.lost.then(info => {
      console.error('WebGPU device lost:', info.message)
    })

    const renderer = new Renderer(device, canvas)
    const pipelineCache = new PipelineCache(device)
    const uniformPool = new UniformPool(device, UNIFORM_POOL_SIZE)

    // ── Shared bind group layouts ────────────────────────────────────────────
    const cameraLayout = device.createBindGroupLayout({
      label: 'camera-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    })

    const objectLayout = device.createBindGroupLayout({
      label: 'object-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform', hasDynamicOffset: false },
      }],
    })

    const fbxMaterialLayout = device.createBindGroupLayout({
      label: 'fbx-material-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    })

    const layouts: BindGroupLayouts = { camera: cameraLayout, object: objectLayout, fbxMaterial: fbxMaterialLayout }

    // Default camera
    const camera = new Camera(device, cameraLayout, {})

    return new Engine(canvas, renderer, pipelineCache, uniformPool, layouts, camera)
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  setCamera(camera: Camera): void {
    this._camera = camera
  }

  get camera(): Camera { return this._camera }

  // ── Factory methods for renderables ────────────────────────────────────────

  createMesh(opts: MeshOptions): MeshHandle {
    const mesh = new Mesh(opts)
    mesh.init(this._initArgs())
    this._scene.add(mesh)
    return mesh
  }

  createComputedMesh(opts: ComputedMeshOptions): ComputedRenderableHandle {
    const cr = new ComputedRenderable(opts)
    cr.init(this._initArgs())
    this._scene.add(cr)
    return cr
  }

  createQuad2D(opts: Quad2DOptions): Quad2DHandle {
    const q = new Quad2D(opts)
    q.init(this._initArgs())
    this._scene.add(q)
    return q
  }

  createQuad3D(opts: Quad3DOptions): Quad3DHandle {
    const q = new Quad3D(opts)
    q.init(this._initArgs())
    this._scene.add(q)
    return q
  }

  /**
   * Fetches and parses a .obj file, uploading its geometry to GPU once.
   * The returned ModelAssetHandle can be passed to createModel3D() many times.
   * Non-blocking: the fetch is async; parsing runs synchronously after the response arrives.
   */
  async loadModel(url: string): Promise<ModelAssetHandle> {
    const bytes = await this._fetchWithLimit(url, 'loadModel')
    const text = new TextDecoder().decode(bytes)
    const { vertices, indices } = parseObj(text)
    return new ModelAsset(this._renderer.device, this._renderer.queue, vertices, indices)
  }

  /** Creates a Model3D instance from a loaded ModelAsset. Sync and fast — no GPU buffer upload. */
  createModel3D(opts: Model3DOptions): Model3DHandle {
    const model = new Model3D(opts)
    model.init(this._initArgs())
    this._scene.add(model)
    return model
  }

  /**
   * Fetches and parses a .fbx file, uploading all mesh geometry and textures to GPU once.
   * The returned FbxAssetHandle can be passed to createFbxModel() many times.
   */
  async loadFbx(url: string): Promise<FbxAssetHandle> {
    const bytes = await this._fetchWithLimit(url, 'loadFbx')
    const parsed = await parseFbx(bytes)
    return new FbxAsset(
      this._renderer.device,
      this._renderer.queue,
      this._layouts.fbxMaterial,
      parsed,
    )
  }

  /** Creates an FbxModel instance from a loaded FbxAsset. Sync and fast — no GPU buffer upload. */
  createFbxModel(opts: FbxModelOptions): FbxModelHandle {
    const model = new FbxModel(opts)
    model.init(this._initArgs())
    this._scene.add(model)
    return model
  }

  /** Creates a Camera with the given options using the engine's device and camera layout. */
  createCamera(opts: CameraOptions = {}): Camera {
    const cameraLayout = this._layouts.camera
    return new Camera(this._renderer.device, cameraLayout, opts)
  }

  // ── RAF loop ────────────────────────────────────────────────────────────────

  start(): void {
    if (this._rafHandle !== 0) return
    const loop = () => {
      this._rafHandle = requestAnimationFrame(loop)
      this._scene.frame(this._camera, this._canvas)
    }
    this._rafHandle = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this._rafHandle !== 0) {
      cancelAnimationFrame(this._rafHandle)
      this._rafHandle = 0
    }
  }

  // ── Escape hatches ──────────────────────────────────────────────────────────

  get device(): GPUDevice { return this._renderer.device }
  get canvas(): HTMLCanvasElement { return this._canvas }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async _fetchWithLimit(url: string, label: string): Promise<Uint8Array> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${label}: failed to fetch "${url}" (${response.status})`)

    const contentLength = response.headers.get('Content-Length')
    if (contentLength !== null && Number(contentLength) > MAX_ASSET_BYTES)
      throw new Error(`${label}: asset too large (Content-Length ${contentLength} > ${MAX_ASSET_BYTES})`)

    if (!response.body) throw new Error(`${label}: response body is null`)

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_ASSET_BYTES)
        throw new Error(`${label}: asset exceeded ${MAX_ASSET_BYTES} bytes during download`)
      chunks.push(value)
    }

    const result = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
    return result
  }

  private _initArgs(): RenderableInitArgs {
    return {
      device: this._renderer.device,
      queue: this._renderer.queue,
      format: this._renderer.format,
      pipelineCache: this._pipelineCache,
      layouts: this._layouts,
      uniformPool: this._uniformPool,
    }
  }
}
