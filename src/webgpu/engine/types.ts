import type { Vec3, Vec4 } from './math/vec';
import type { Hitbox3D } from './gameObject/3D/hitbox/Hitbox3D';
import type { Rigidbody3D } from './gameObject/3D/rigidbody/Rigidbody3D';

// ── Engine ─────────────────────────────────────────────────────────────────

export interface EngineOptions {
  powerPreference?: GPUPowerPreference
}

// ── Camera ─────────────────────────────────────────────────────────────────

export interface CameraOptions {
  fovY?: number                        // radians, default Math.PI / 3
  near?: number                        // default 0.1
  far?: number                         // default 2000
  position?: [number, number, number]  // world-space, default [0, 0, 0]
  yaw?: number                         // radians, default 0
  pitch?: number                       // radians, default 0
}

// ── Shared bind group layouts passed to renderable init ────────────────────

/** @internal */
export interface BindGroupLayouts {
  camera:      GPUBindGroupLayout  // group 0 — camera uniform
  object:      GPUBindGroupLayout  // group 1 — per-object uniform (model + tint)
  fbxMaterial: GPUBindGroupLayout  // group 2 — FBX diffuse + normal map textures
  lights:      GPUBindGroupLayout  // group 3 — light buffer (world-pass shaders)
  empty:       GPUBindGroupLayout  // placeholder for unused group slots
  gizmo:       GPUBindGroupLayout  // group 2 — ArrowGizmo axis colors + visibility
  groundExtra: GPUBindGroupLayout  // group 2 — InfiniteGround secondary color + tile size
}

// ── Renderable options (used inside renderable: { ... } when creating GameObjects) ──

export interface MeshOptions {
  /** Interleaved: vec3f position, f32 pad, vec3f normal, f32 pad, vec4f color — 48 bytes/vertex */
  vertices: Float32Array
  /** Optional index buffer (uint32). If absent, draws as non-indexed triangle-list. */
  indices?: Uint32Array
  label?: string
}

export interface Quad2DOptions {
  /** NDC x of the top-left corner, range [-1, 1]. */
  x: number
  /** NDC y of the top-left corner, range [-1, 1]. */
  y: number
  /** Width in NDC units. */
  width: number
  /** Height in NDC units. */
  height: number
  color: [number, number, number, number]
  label?: string
}

export interface Quad3DOptions {
  /** Face normal (determines orientation). Default [0, 1, 0]. */
  normal?: [number, number, number]
  width: number
  height: number
  color: [number, number, number, number]
  label?: string
}

/** Shared GPU resource produced by engine.loadObj(). Safe to pass to createModelObj() many times. */
export interface ModelAssetHandle {
  readonly vertexCount: number
  readonly indexCount: number
  destroy(): void
}

export interface Model3DOptions {
  asset: ModelAssetHandle
  /** RGBA tint multiplied with vertex color. Default [1, 1, 1, 1]. */
  tint?: [number, number, number, number]
  label?: string
}

/** Shared GPU resource produced by engine.loadFbx(). Safe to pass to createFbxModel() many times. */
export interface FbxAssetHandle {
  readonly sliceCount: number
  /**
   * Replaces the diffuse texture of a single mesh slice at runtime.
   * Fetches the image at `url`, uploads it to the GPU, and rebuilds the
   * material bind group for `sliceIndex`. The previous texture is destroyed.
   */
  setSliceTexture(sliceIndex: number, url: string): Promise<void>
  destroy(): void
}

export interface FbxModelOptions {
  asset: FbxAssetHandle
  /** RGBA tint multiplied in the shader. Default [1, 1, 1, 1]. */
  tint?: [number, number, number, number]
  label?: string
}

// ── GameObject creation options ────────────────────────────────────────────

/** Common game-object fields shared by all Engine.create*() methods. */
export interface GameObjectBaseOptions {
  position?:        Vec3
  quaternion?:      Vec4
  scale?:           Vec3
  hitbox?:          Hitbox3D
  rigidbody?:       Rigidbody3D
  /** Positional offset of the physics body center relative to the visual origin, in local space. */
  rigidbodyOffset?: Vec3
}

export interface MeshGameObjectOptions extends GameObjectBaseOptions {
  renderable: MeshOptions
}

export interface CubeGameObjectOptions extends GameObjectBaseOptions {
  /** RGBA vertex color baked into each face. Default [1, 1, 1, 1]. */
  color?: [number, number, number, number]
  label?: string
}

export interface Quad2DGameObjectOptions extends GameObjectBaseOptions {
  renderable: Quad2DOptions
}

export interface Quad3DGameObjectOptions extends GameObjectBaseOptions {
  renderable: Quad3DOptions
}

export interface Model3DGameObjectOptions extends GameObjectBaseOptions {
  renderable: Model3DOptions
}

export interface FbxModelGameObjectOptions extends GameObjectBaseOptions {
  renderable: FbxModelOptions
}

// ── ArrowGizmo creation options ───────────────────────────────────────────────

export interface ArrowGizmoOptions {
  /** RGBA color for the X axis arrow. Default: [1, 0.15, 0.15, 1] */
  colorX?: [number, number, number, number]
  /** RGBA color for the Y axis arrow. Default: [0.15, 1, 0.15, 1] */
  colorY?: [number, number, number, number]
  /** RGBA color for the Z axis arrow. Default: [0.15, 0.15, 1, 1] */
  colorZ?: [number, number, number, number]
  label?: string
}

// ── Light creation options ─────────────────────────────────────────────────

export interface PointLightOptions {
  color?:  Vec3
  radius?: number
}

export interface AmbientLightOptions {
  color?:    Vec3
  strength?: number
}

export interface DirectionalLightOptions {
  direction?: Vec3
  color?:     Vec3
  power?:     number
}

// ── Skybox / InfiniteGround creation options ───────────────────────────────

export interface SkyboxOptions {
  /** Solid background color. Default: [0.1, 0.12, 0.15, 1]. */
  color?: [number, number, number, number]
}

export interface InfiniteGroundOptions {
  /** Primary tile color. Default: [0.55, 0.55, 0.55, 1]. */
  color?: [number, number, number, number]
  /** Alternate tile color. Default: [0.45, 0.45, 0.45, 1]. */
  alternateColor?: [number, number, number, number]
  /** World Y position of the ground plane. Default: 0. */
  yLevel?: number
  /** Checkerboard tile size in world units (powers of 2 recommended). Default: 16. */
  tileSize?: number
}

// ── Bar3D ──────────────────────────────────────────────────────────────────

export interface Bar3DOptions {
  /** World-space initial position. Default [0, 0, 0]. */
  position?:       Vec3
  width:           number
  height:          number
  /** Border thickness in world units. */
  borderThickness: number
  borderColor:     [number, number, number, number]
  fillColor:       [number, number, number, number]
  /** Empty-zone color. Default transparent [0, 0, 0, 0]. */
  emptyColor?:     [number, number, number, number]
  /** Fill level 0–1. Default 1. */
  percentage?:     number
  label?:          string
}
