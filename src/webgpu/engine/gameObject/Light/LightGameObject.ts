import type { Vec3, Vec4 } from '../../math/vec';
import { yawPitchRollToQuat, rotateByQuat } from '../../math/quat';
import type { LightBuffer } from '../../buffers/LightBuffer';
import type { ISceneObject } from '../3D/3DGameObject';
import type { Rigidbody3D } from '../3D/rigidbody/Rigidbody3D';
import type { RenderableInitArgs } from '../3D/renderables/Renderable';
import type { Scene } from '../../core/Scene';
import { LightCrossRenderable } from '../3D/renderables/LightCrossRenderable';
import { logger } from '../../utils/logger';

export const LightType = {
  Ambient:     0,
  Point:       1,
  Directional: 2,
} as const;
export type LightType = typeof LightType[keyof typeof LightType]

const DEFAULT_COLOR:  Vec3   = [1, 1, 1];
const DEFAULT_RADIUS: number = 10;

export class LightGameObject implements ISceneObject {
  position:   Vec3 = [0, 0, 0];
  quaternion: Vec4 = [0, 0, 0, 1];
  scale:      Vec3 = [1, 1, 1];

  lightType: LightType;           // mutable — user can switch point ↔ ambient in the sandbox
  private _color: [number, number, number, number];
  private _radius: number;
  private _direction: Vec3 = [0, 0, -1];
  private readonly _lightBuffer: LightBuffer;
  private readonly _destroyFn: () => void;

  private _renderable: LightCrossRenderable | null = null;
  private _scene: Scene | null = null;
  private _property: Record<string, any> = {};

  constructor(opts: {
    lightType:   LightType
    color?:      Vec3
    radius?:     number
    lightBuffer: LightBuffer
    _destroy:    () => void
  }) {
    this.lightType    = opts.lightType;
    this._color       = [...(opts.color ?? DEFAULT_COLOR), 1];
    this._radius      = opts.radius ?? DEFAULT_RADIUS;
    this._lightBuffer = opts.lightBuffer;
    this._destroyFn   = opts._destroy;
  }

  get color(): [number, number, number, number] { return this._color; }
  get radius(): number                          { return this._radius; }
  get direction(): Vec3                         { return this._direction; }

  /** Returns the value to upload into the GPU position slot.
   *  For directional lights: the direction vector.
   *  For all other types: the world-space position. */
  get gpuPosition(): Vec3 {
    return this.lightType === LightType.Directional ? this._direction : this.position;
  }

      registerProperty(key: string, value: any): void {
        if(this._property[key] !== undefined) {
            console.warn(`Overwriting existing property '${key}' on LightGameObject`);
            return;
        }
        this._property[key] = value;
    }
    
    setProperty(key: string, value: any): void {
        if(this._property[key] === undefined) {
            console.warn(`non existing property '${key}' on LightGameObject`);
            return;
        }
        this._property[key] = value;
    }
    
    removeProperty(key: string): void {
        delete this._property[key];
    }
    getProperty(key: string): any {
        return this._property[key];
    }

  setPosition(position: Vec3): void {
    this.position = [...position];
    this._lightBuffer.markDirty();
  }

  setColor(r: number, g: number, b: number, a: number): void {
    this._color = [r, g, b, a];
    this._lightBuffer.markDirty();
  }

  setLightType(type: LightType): void {
    this.lightType = type;
    this.setVisualizationVisible(type !== LightType.Ambient);
    this._lightBuffer.markDirty();
  }

  setRadius(radius: number): void {
    if (this.lightType === LightType.Ambient) {
      logger.error('LightGameObject: setRadius() has no effect on ambient lights');
      return;
    }
    this._radius = radius;
    this._lightBuffer.markDirty();
  }


  /** Set the light direction directly (normalized). Only meaningful for Directional lights. */
  setDirection(direction: Vec3): void {
    const length = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
    // REVIEW [BEST PRACTICE]: exact float equality — prefer `length < 1e-10` as a near-zero guard.
    if (length === 0) return;
    this._direction = [direction[0] / length, direction[1] / length, direction[2] / length];
    this._lightBuffer.markDirty();
  }

  setRotation(yaw: number, pitch: number, roll = 0): void {
    if (this.lightType !== LightType.Directional) return;
    this.quaternion  = yawPitchRollToQuat(yaw, pitch, roll);
    this._direction  = rotateByQuat([0, 0, -1], this.quaternion);
    this._lightBuffer.markDirty();
  }

  // ── Visualization ────────────────────────────────────────────────────────────

  /** @internal */
  initRenderable(args: RenderableInitArgs, scene: Scene): void {
    this._renderable = new LightCrossRenderable(this, args);
    this._scene = scene;
    scene.add(this._renderable);
    if (this.lightType === LightType.Ambient) this._renderable.visible = false;
  }

  setVisualizationVisible(visible: boolean): void {
    if (this._renderable) this._renderable.visible = visible;
  }

  // ISceneObject no-ops — orientation and scale are irrelevant for non-directional lights
  setQuaternion(_quaternion: Vec4): void {}
  rotate(_yaw: number, _pitch: number, _roll?: number): void {}
  setScale(_x: number, _y: number, _z: number): void {}
  getRigidbody(): Rigidbody3D | null { return null; }

  destroy(): void {
    if (this._renderable && this._scene) {
      this._scene.remove(this._renderable);
      this._renderable.destroy();
    }
    this._destroyFn();
  }
}
