import type { CapsuleHitbox } from "../hitbox/CapsuleHitbox";
import type { CubeHitbox } from "../hitbox/CubeHitbox";
import type { Hitbox3D } from "../hitbox/Hitbox3D";
import type { MeshHitbox } from "../hitbox/MeshHitbox";
import type { SphereHitbox } from "../hitbox/SphereHitbox";

/** @internal */
export interface AABB { min: [number, number, number]; max: [number, number, number] }

/** @internal */
export function extractOBBAxes(orientation: Float32Array): [[number,number,number],[number,number,number],[number,number,number]] {
  return [
    [orientation[0], orientation[1], orientation[2]],
    [orientation[4], orientation[5], orientation[6]],
    [orientation[8], orientation[9], orientation[10]],
  ];
}

/**
 * Computes the world-space AABB for any hitbox type.
 * - Sphere/mesh: center ± radius or halfExtents on each axis.
 * - Capsule: capsule axis projected onto each world axis, plus radius.
 * - Cube (OBB): enumerates all 8 corners in world space for a tight fit.
 * - Plane: returns a near-infinite AABB; narrow phase handles the real geometry.
 * @internal
 */
export function computeWorldAABB(hitbox: Hitbox3D): AABB {
  const center = hitbox.worldCenter;
  switch (hitbox.type) {
    case 'sphere': {
      const radius = (hitbox as SphereHitbox).radius;
      return {
        min: [center[0] - radius, center[1] - radius, center[2] - radius],
        max: [center[0] + radius, center[1] + radius, center[2] + radius],
      };
    }
    case 'cube': {
      const halfExtents = (hitbox as CubeHitbox).halfExtents;
      const axes = extractOBBAxes(hitbox.orientation);
      const minBounds: [number,number,number] = [Infinity, Infinity, Infinity];
      const maxBounds: [number,number,number] = [-Infinity, -Infinity, -Infinity];
      for (let signX = -1; signX <= 1; signX += 2) {
        for (let signY = -1; signY <= 1; signY += 2) {
          for (let signZ = -1; signZ <= 1; signZ += 2) {
            const worldCorner: [number,number,number] = [
              center[0] + axes[0][0] * halfExtents[0] * signX + axes[1][0] * halfExtents[1] * signY + axes[2][0] * halfExtents[2] * signZ,
              center[1] + axes[0][1] * halfExtents[0] * signX + axes[1][1] * halfExtents[1] * signY + axes[2][1] * halfExtents[2] * signZ,
              center[2] + axes[0][2] * halfExtents[0] * signX + axes[1][2] * halfExtents[1] * signY + axes[2][2] * halfExtents[2] * signZ,
            ];
            for (let i = 0; i < 3; i++) {
              if (worldCorner[i] < minBounds[i]) minBounds[i] = worldCorner[i];
              if (worldCorner[i] > maxBounds[i]) maxBounds[i] = worldCorner[i];
            }
          }
        }
      }
      return { min: minBounds, max: maxBounds };
    }
    case 'capsule': {
      const capsule = hitbox as CapsuleHitbox;
      const halfLength = capsule.height * 0.5;
      const upAxis: [number,number,number] = [hitbox.orientation[4], hitbox.orientation[5], hitbox.orientation[6]];
      return {
        min: [
          center[0] - Math.abs(upAxis[0]) * halfLength - capsule.radius,
          center[1] - Math.abs(upAxis[1]) * halfLength - capsule.radius,
          center[2] - Math.abs(upAxis[2]) * halfLength - capsule.radius,
        ],
        max: [
          center[0] + Math.abs(upAxis[0]) * halfLength + capsule.radius,
          center[1] + Math.abs(upAxis[1]) * halfLength + capsule.radius,
          center[2] + Math.abs(upAxis[2]) * halfLength + capsule.radius,
        ],
      };
    }
    case 'mesh': {
      const halfExtents = (hitbox as MeshHitbox).halfExtents;
      return {
        min: [center[0] - halfExtents[0], center[1] - halfExtents[1], center[2] - halfExtents[2]],
        max: [center[0] + halfExtents[0], center[1] + halfExtents[1], center[2] + halfExtents[2]],
      };
    }
    case 'plane':
      // A plane is infinite — any AABB overlaps it. Narrow phase handles geometry.
      return { min: [-1e9, -1e9, -1e9], max: [1e9, 1e9, 1e9] };
  }
}

/** @internal */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.max[0] > b.min[0] && a.min[0] < b.max[0]
      && a.max[1] > b.min[1] && a.min[1] < b.max[1]
      && a.max[2] > b.min[2] && a.min[2] < b.max[2];
}
