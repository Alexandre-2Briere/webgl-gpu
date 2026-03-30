import type { IGameObject } from '../GameObject'

const GRAVITY = 9.81

/**
 * Game-loop helper — step 1 of 2.
 *
 * For each object:
 *   1. Syncs the GameObject transform → Rigidbody3D  (syncToPhysics)
 *   2. Applies gravity and integrates velocity → position  (Euler)
 *   3. Updates the hitbox world orientation
 *
 * Does NOT call syncFromPhysics — that is owned by applyCollisions so the
 * collision step can read/write the rigidbody positions before they propagate
 * back to the visual representation.
 */
export function applyPhysics(objects: IGameObject[], dt: number): void {
  for (const obj of objects) {
    if (obj.getRigidbody()) obj.syncToPhysics()
  }

  for (const obj of objects) {
    const rb = obj.getRigidbody()
    if (!rb || rb.isStatic) continue
    if (rb.useGravity) rb.velocity[1] -= GRAVITY * dt
    rb.position[0] += rb.velocity[0] * dt
    rb.position[1] += rb.velocity[1] * dt
    rb.position[2] += rb.velocity[2] * dt
    rb.hitbox?.updateOrientation(rb.position, rb.quaternion)
  }
}
