import type { ISceneObject } from '../3D/3DGameObject';
import { SkyboxRenderable } from '../3D/renderables/SkyboxRenderable';
import type { Scene } from '../../core/Scene';
import type { Vec3, Vec4 } from '../../math/vec';
import type { Rigidbody3D } from '../3D/rigidbody/Rigidbody3D';

/**
 * Singleton scene object that fills the background with a solid color.
 * Implements ISceneObject — position/quaternion/scale/rotation are irrelevant
 * for a fullscreen fill and are no-ops.
 * Created exclusively via Engine.createSkybox().
 */
export class SkyboxGameObject implements ISceneObject {
  position:   Vec3 = [0, 0, 0];
  quaternion: Vec4 = [0, 0, 0, 1];
  scale:      Vec3 = [1, 1, 1];

  private readonly _renderable: SkyboxRenderable;
  private readonly _scene: Scene;
  private readonly _destroyFn: () => void;

  /** @internal */
  constructor(opts: {
    renderable: SkyboxRenderable
    scene:      Scene
    _destroy:   () => void
  }) {
    this._renderable = opts.renderable;
    this._scene      = opts.scene;
    this._destroyFn  = opts._destroy;
  }

  get color(): [number, number, number, number] {
    return this._renderable.color;
  }

  setColor(r: number, g: number, b: number, a: number): void {
    this._renderable.setColor(r, g, b, a);
  }

  // ── ISceneObject stubs (transform has no meaning for a fullscreen quad) ──────

  setPosition(_position: Vec3): void {}
  setQuaternion(_quaternion: Vec4): void {}
  setRotation(_yaw: number, _pitch: number, _roll?: number): void {}
  rotate(_yaw: number, _pitch: number, _roll?: number): void {}
  setScale(_x: number, _y: number, _z: number): void {}
  getRigidbody(): Rigidbody3D | null { return null; }

  destroy(): void {
    this._scene.removeSkybox();
    this._renderable.destroy();
    this._destroyFn();
  }
}
