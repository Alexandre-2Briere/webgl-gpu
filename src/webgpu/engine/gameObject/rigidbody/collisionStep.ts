import type { IGameObject } from '../GameObject'
import { type Rigidbody3D } from './Rigidbody3D'
import { computeWorldAABB, aabbOverlap } from './broadPhase'
import { narrowPhase } from './narrowPhase'

/**
 * Game-loop helper — step 2 of 2.
 *
 * Accepts a pre-built layer map (maintained by the caller on spawn/destroy)
 * so no per-frame grouping is needed.
 *
 * For each layer:
 *   1. Broad phase (AABB overlap)
 *   2. Narrow phase (shape-pair test)
 *   3. onOverlap callbacks
 *   4. Positional correction (push bodies apart by penetration depth)
 *   5. Velocity impulse (perfectly inelastic response)
 *   6. Hitbox resync
 *   7. onCollision callbacks
 *
 * After all layers are resolved, syncs every rigidbody position back to
 * its GameObject (syncFromPhysics).
 */
export function applyCollisions(
  layerMap: Map<string, Rigidbody3D[]>,
  objects: IGameObject[],
): void {
  for (const [, bodies] of layerMap) {
    for (let i = 0; i < bodies.length - 1; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        _resolvePair(bodies[i], bodies[j])
      }
    }
  }

  for (const obj of objects) {
    if (obj.getRigidbody()) obj.syncFromPhysics()
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _resolvePair(bodyA: Rigidbody3D, bodyB: Rigidbody3D): void {
  const hitboxA = bodyA.hitbox!
  const hitboxB = bodyB.hitbox!

  if (!aabbOverlap(computeWorldAABB(hitboxA), computeWorldAABB(hitboxB))) return

  const result = narrowPhase(hitboxA, hitboxB)
  if (!result.hit) return

  bodyA.onOverlap?.(bodyB)
  bodyB.onOverlap?.(bodyA)

  const { depth, normal } = result
  const aIsStatic = bodyA.isStatic
  const bIsStatic = bodyB.isStatic
  if (aIsStatic && bIsStatic) return

  // Positional correction — push bodies apart proportional to mass.
  // normal points from B toward A (A.center - B.center), so A moves in +normal, B in -normal.
  if (!aIsStatic && !bIsStatic) {
    const totalMass = bodyA.mass + bodyB.mass
    const corrA = bodyB.mass / totalMass
    const corrB = bodyA.mass / totalMass
    bodyA.position[0] += normal[0] * depth * corrA
    bodyA.position[1] += normal[1] * depth * corrA
    bodyA.position[2] += normal[2] * depth * corrA
    bodyB.position[0] -= normal[0] * depth * corrB
    bodyB.position[1] -= normal[1] * depth * corrB
    bodyB.position[2] -= normal[2] * depth * corrB
  } else if (!aIsStatic) {
    bodyA.position[0] += normal[0] * depth
    bodyA.position[1] += normal[1] * depth
    bodyA.position[2] += normal[2] * depth
  } else {
    bodyB.position[0] -= normal[0] * depth
    bodyB.position[1] -= normal[1] * depth
    bodyB.position[2] -= normal[2] * depth
  }

  // Velocity impulse (perfectly inelastic)
  const invMassA = aIsStatic ? 0 : 1 / bodyA.mass
  const invMassB = bIsStatic ? 0 : 1 / bodyB.mass
  const denom = invMassA + invMassB
  if (denom > 1e-10) {
    const relNormalVel = (bodyA.velocity[0] - bodyB.velocity[0]) * normal[0]
                      + (bodyA.velocity[1] - bodyB.velocity[1]) * normal[1]
                      + (bodyA.velocity[2] - bodyB.velocity[2]) * normal[2]
    if (relNormalVel < 0) {
      const impulse = -relNormalVel / denom
      bodyA.velocity[0] += invMassA * impulse * normal[0]
      bodyA.velocity[1] += invMassA * impulse * normal[1]
      bodyA.velocity[2] += invMassA * impulse * normal[2]
      bodyB.velocity[0] -= invMassB * impulse * normal[0]
      bodyB.velocity[1] -= invMassB * impulse * normal[1]
      bodyB.velocity[2] -= invMassB * impulse * normal[2]
    }
  }

  // Re-sync hitboxes after positional correction
  if (!aIsStatic) hitboxA.updateOrientation(bodyA.position, bodyA.quaternion)
  if (!bIsStatic) hitboxB.updateOrientation(bodyB.position, bodyB.quaternion)

  bodyA.onCollision?.(bodyB)
  bodyB.onCollision?.(bodyA)
}
