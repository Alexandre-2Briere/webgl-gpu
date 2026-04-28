import type { Hitbox3D } from './hitbox/Hitbox3D';
import type { Rigidbody3D } from './rigidbody/Rigidbody3D';
import type { Vec3, Vec4 } from '../../math/vec';
import { applyEulerDelta, yawPitchRollToQuat, rotateByQuat } from '../../math/quat';
import type { Renderable } from './renderables/Renderable';

// ── Public interfaces ─────────────────────────────────────────────────────────

/** Minimum interface shared by all scene objects (GameObjects and LightGameObjects). */
export interface ISceneObject {
  position:   Vec3
  quaternion: Vec4
  scale:      Vec3
  readonly color: [number, number, number, number]

  setPosition(position: Vec3): void
  setQuaternion(quaternion: Vec4): void
  /** Set rotation from Euler angles (yaw = Y-axis, pitch = X-axis, roll = Z-axis, radians). */
  setRotation(yaw: number, pitch: number, roll?: number): void
  /** Apply a relative Euler rotation on top of the current orientation. */
  rotate(yaw: number, pitch: number, roll?: number): void
  setScale(x: number, y: number, z: number): void
  setColor(r: number, g: number, b: number, a: number): void

  getRigidbody(): Rigidbody3D | null
  destroy(): void
}

export interface IGameObject<R extends Renderable = Renderable> extends ISceneObject {
  readonly renderable: R
  readonly hitbox:     Hitbox3D    | null
  readonly rigidbody:  Rigidbody3D | null

  /** @internal */
  syncToPhysics(): void
  /** @internal */
  syncFromPhysics(): void

  // Lifecycle
  copy(): IGameObject<R>
}

// ── Internal options ──────────────────────────────────────────────────────────

/** @internal */
export interface GameObjectOptions<R extends Renderable = Renderable> {
  renderable:       R
  position?:        Vec3
  quaternion?:      Vec4
  scale?:           Vec3
  hitbox?:          Hitbox3D
  rigidbody?:       Rigidbody3D
  /** Positional offset of the physics body relative to the visual center, in local space. */
  rigidbodyOffset?: Vec3
  /** Injected by Engine: create a sibling GameObject of the same type. */
  _copy:    () => IGameObject<R>
  /** Injected by Engine: remove from scene and free GPU memory. */
  _destroy: () => void
}

// ── Class ─────────────────────────────────────────────────────────────────────

/**
 * The sole user-facing game entity.
 *
 * Owns a Renderable (fixed at creation), an optional Hitbox3D, and an optional
 * Rigidbody3D.  Transform ownership:
 *   - `position`, `quaternion`, and `scale` on this class are the source of truth.
 *   - Use `setPosition` / `setQuaternion` / `rotate` / `setRotation` for direct movement.
 *   - These are called automatically by `applyPhysics` and `applyCollisions`.
 */
export class GameObject<R extends Renderable = Renderable> implements IGameObject<R> {
  readonly renderable: R;
  readonly hitbox:     Hitbox3D    | null;
  readonly rigidbody:  Rigidbody3D | null;

  property: Record<string, any> = {};
  position:   Vec3;
  quaternion: Vec4;
  scale:      Vec3;

  private readonly _rigidbodyOffset: Vec3;
  private readonly _copyFn:    () => IGameObject<R>;
  private readonly _destroyFn: () => void;

  constructor(opts: GameObjectOptions<R>) {
    this.renderable       = opts.renderable;
    this.hitbox           = opts.hitbox     ?? null;
    this.rigidbody        = opts.rigidbody  ?? null;
    this.position         = opts.position   ? [...opts.position]   : [0, 0, 0];
    this.quaternion       = opts.quaternion ? [...opts.quaternion] : [0, 0, 0, 1];
    this.scale            = opts.scale      ? [...opts.scale]      : [1, 1, 1];
    this._rigidbodyOffset = opts.rigidbodyOffset ? [...opts.rigidbodyOffset] : [0, 0, 0];
    this._copyFn          = opts._copy;
    this._destroyFn       = opts._destroy;
    this._applyTransform();
  }

  // ─── Transform ────────────────────────────────────────────────────────────

  setPosition(position: Vec3): void {
    this.position = [...position];
    this._applyTransform();
  }

  registerProperty(key: string, value: any): void {
    if(this.property[key] !== undefined) {
      console.warn(`Overwriting existing property '${key}' on GameObject`);
      return;
    }
    this.property[key] = value;
  }
  setProperty(key: string, value: any): void {
    if(this.property[key] === undefined) {
      console.warn(`non existing property '${key}' on GameObject`);
      return;
    }
    this.property[key] = value;
  }
  removeProperty(key: string): void {
    delete this.property[key];
  }
  getProperty(key: string): any {
    return this.property[key];
  }

  setQuaternion(quaternion: Vec4): void {
    this.quaternion = [...quaternion];
    this._applyTransform();
  }

  setRotation(yaw: number, pitch: number, roll = 0): void {
    this.quaternion = yawPitchRollToQuat(yaw, pitch, roll);
    this._applyTransform();
  }

  rotate(yaw: number, pitch: number, roll = 0): void {
    this.quaternion = applyEulerDelta(this.quaternion, yaw, pitch, roll);
    this._applyTransform();
  }

  setScale(x: number, y: number, z: number): void {
    this.scale = [x, y, z];
    this._applyTransform();
  }

  get color(): [number, number, number, number] {
    return this.renderable.color;
  }

  setColor(r: number, g: number, b: number, a: number): void {
    this.renderable.setColor(r, g, b, a);
  }

  // ─── Physics sync ─────────────────────────────────────────────────────────

  /**
   * Copy current transform into the rigidbody so the physics step starts from
   * the correct world transform.  Called by `applyPhysics` each frame.
   */
  getRigidbody(): Rigidbody3D | null {
    return this.rigidbody;
  }

  /** @internal */
  syncToPhysics(): void {
    if (!this.rigidbody) return;
    const rotated = rotateByQuat(this._rigidbodyOffset, this.quaternion);
    this.rigidbody.position   = [
      this.position[0] + rotated[0],
      this.position[1] + rotated[1],
      this.position[2] + rotated[2],
    ];
    this.rigidbody.quaternion = [...this.quaternion];
  }

  /**
   * Read the rigidbody's post-simulation position + quaternion back and apply
   * them to the renderable and hitbox.  Called by `applyCollisions` each frame.
   * @internal
   */
  syncFromPhysics(): void {
    if (!this.rigidbody) return;
    const rotated = rotateByQuat(this._rigidbodyOffset, this.rigidbody.quaternion);
    this.position   = [
      this.rigidbody.position[0] - rotated[0],
      this.rigidbody.position[1] - rotated[1],
      this.rigidbody.position[2] - rotated[2],
    ];
    this.quaternion = structuredClone(this.rigidbody.quaternion);
    this._applyTransform();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Create a new independent GameObject of the same type at the same transform. */
  copy(): IGameObject<R> {
    return this._copyFn();
  }

  /** Remove this GameObject from the scene and free its GPU memory. */
  destroy(): void {
    this._destroyFn();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _applyTransform(): void {
    this.renderable.setPosition(this.position);
    this.renderable.setQuaternion(this.quaternion);
    this.renderable.setScale(this.scale[0], this.scale[1], this.scale[2]);
    this.hitbox?.updateOrientation(this.position, this.quaternion);
  }
}
