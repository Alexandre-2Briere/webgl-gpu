import type { ISceneObject } from '../3D/3DGameObject';
import { Rigidbody3D } from '../3D/rigidbody/Rigidbody3D';
import { PlaneHitbox } from '../3D/hitbox/PlaneHitbox';
import { InfiniteGroundRenderable } from '../3D/renderables/InfiniteGroundRenderable';
import type { Scene } from '../../core/Scene';
import type { Vec3, Vec4 } from '../../math/vec';

const IDENTITY_QUAT: Vec4 = [0, 0, 0, 1];

/**
 * Singleton scene object representing an infinite checkerboard ground plane.
 * Exposes Y level, primary color, alternate color, and tile size.
 * Provides a static PlaneHitbox on the 'default' physics layer for collision.
 * Created exclusively via Engine.createInfiniteGround().
 */
export class InfiniteGroundGameObject implements ISceneObject {
  position:   Vec3 = [0, 0, 0];
  quaternion: Vec4 = [0, 0, 0, 1];
  scale:      Vec3 = [1, 1, 1];

  private readonly _renderable: InfiniteGroundRenderable;
  private readonly _scene: Scene;
  private readonly _rigidbody: Rigidbody3D;
  private readonly _planeHitbox: PlaneHitbox;
  private readonly _destroyFn: () => void;

  /** @internal */
  constructor(opts: {
    renderable: InfiniteGroundRenderable
    scene:      Scene
    yLevel?:    number
    _destroy:   () => void
  }) {
    this._renderable = opts.renderable;
    this._scene      = opts.scene;
    this._destroyFn  = opts._destroy;

    this._planeHitbox = new PlaneHitbox('y');
    const initialY = opts.yLevel ?? 0;
    this._planeHitbox.updateOrientation([0, initialY, 0], IDENTITY_QUAT);

    this._rigidbody = new Rigidbody3D({
      layer:      'default',
      isStatic:   true,
      useGravity: false,
      hitbox:     this._planeHitbox,
    });
    this._rigidbody.position = [0, initialY, 0];

    this.position = [0, initialY, 0];
  }

  // ── Y level ──────────────────────────────────────────────────────────────────

  get yLevel(): number { return this._renderable.yLevel; }

  setYLevel(y: number): void {
    this._renderable.setPosition([0, y, 0]);
    this._planeHitbox.updateOrientation([0, y, 0], IDENTITY_QUAT);
    this._rigidbody.position = [0, y, 0];
    this.position = [0, y, 0];
  }

  // ── Colors ───────────────────────────────────────────────────────────────────

  get color(): [number, number, number, number] {
    return this._renderable.color;
  }

  setColor(r: number, g: number, b: number, a: number): void {
    this._renderable.setColor(r, g, b, a);
  }

  get alternateColor(): [number, number, number, number] {
    return this._renderable.alternateColor;
  }

  setAlternateColor(r: number, g: number, b: number, a: number): void {
    this._renderable.setAlternateColor(r, g, b, a);
  }

  // ── Tile size ────────────────────────────────────────────────────────────────

  get tileSize(): number { return this._renderable.tileSize; }

  setTileSize(size: number): void {
    this._renderable.setTileSize(size);
  }

  // ── ISceneObject ─────────────────────────────────────────────────────────────

  /** Use setYLevel() to reposition the ground; direct setPosition is a no-op. */
  setPosition(_position: Vec3): void {}
  setQuaternion(_quaternion: Vec4): void {}
  setRotation(_yaw: number, _pitch: number, _roll?: number): void {}
  rotate(_yaw: number, _pitch: number, _roll?: number): void {}
  setScale(_x: number, _y: number, _z: number): void {}

  getRigidbody(): Rigidbody3D { return this._rigidbody; }

  destroy(): void {
    this._scene.remove(this._renderable);
    this._renderable.destroy();
    this._destroyFn();
  }
}
