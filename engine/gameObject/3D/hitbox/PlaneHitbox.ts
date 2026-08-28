import { Hitbox3D } from './Hitbox3D';
import type { Vec3 } from '../../../math/vec';

export type PlaneAxis = 'x' | 'y' | 'z'

/**
 * Infinite-plane collision shape.
 * Defines a plane perpendicular to `axis` at the world position derived from
 * the owning object's transform.  The plane extends infinitely in the two
 * remaining axes — only the signed distance along `axis` is tested.
 *
 * No rotation is applied to the plane (axis is always world-aligned).
 */
export class PlaneHitbox extends Hitbox3D {
  readonly type = 'plane' as const;
  readonly axis: PlaneAxis;

  constructor(axis: PlaneAxis = 'y') {
    super();
    this.axis = axis;
  }

  /** World-space offset of the plane along its axis. */
  get planeOffset(): number {
    const center = this.worldCenter;
    if (this.axis === 'x') return center[0];
    if (this.axis === 'y') return center[1];
    return center[2];
  }

  /** Unit normal of the plane in world space (positive axis direction). */
  get normal(): Vec3 {
    if (this.axis === 'x') return [1, 0, 0];
    if (this.axis === 'y') return [0, 1, 0];
    return [0, 0, 1];
  }

  clone(): PlaneHitbox {
    const copy = new PlaneHitbox(this.axis);
    copy.offsetTranslation = [...this.offsetTranslation];
    copy.offsetRotation    = [...this.offsetRotation];
    copy.orientation.set(this.orientation);
    return copy;
  }
}
