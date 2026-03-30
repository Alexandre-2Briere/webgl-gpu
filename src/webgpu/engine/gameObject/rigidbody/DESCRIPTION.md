# Rigidbody

## Role

The physics subsystem. Handles per-frame integration (gravity, velocity, position) and collision detection/resolution between rigidbodies. Collision detection is a CPU-side broad-phase + narrow-phase pipeline. Resolution uses mass-proportional positional correction and a perfectly inelastic velocity impulse.

## Key Concepts

- **Rigidbody3D**: Physics state for one object — position, velocity, quaternion, mass, layer, flags. Not aware of the GameObject or renderable; purely a physics entity.
- **physicsStep** (`applyPhysics`): Called once per frame. Applies gravity (if `useGravity`), integrates `velocity → position` via Euler method, syncs hitbox orientation. Skips static bodies.
- **broadPhase**: AABB overlap test. Computes a world-space axis-aligned bounding box for each hitbox type and checks pairwise overlap. Returns candidate pairs for narrow-phase testing.
- **narrowPhase**: Shape-specific collision tests. Dispatches to one of 16 pair functions (4 shapes × 4 shapes). Returns a contact: normal (pointing from B → A) and penetration depth.
- **collisionStep** (`applyCollisions`): Iterates all pairs in a collision layer map. For each colliding pair: fires `onOverlap`, applies positional correction, applies velocity impulse, resyncs hitboxes, fires `onCollision`.
- **narrowPhaseHelper** (internal, no barrel): Shared geometry utilities — OBB SAT, closest-point-on-segment, sphere-vs-OBB, sphere-vs-AABB — used by the narrow-phase pair functions.

## Invariants

- **Y is up**. Gravity is always `−9.81` on the Y axis. There is no gravity direction configuration.
- **No angular velocity**. Rotation changes only through explicit `setQuaternion()` / `rotate()` calls. Collisions do not produce spin.
- **Perfectly inelastic collisions**. After a collision impulse, relative normal velocity is zeroed. Objects do not bounce (restitution = 0).
- **No friction**. Only the normal component of velocity is affected by the impulse.
- **Static bodies** (`isStatic = true`) have `invMass = 0`. They never move, never change velocity, but participate in collision detection and trigger callbacks.
- **Callback order is strict**:
  1. `onOverlap` (pre-resolution)
  2. Positional correction
  3. Velocity impulse
  4. Hitbox resync
  5. `onCollision` (post-resolution)
- The normal returned by `narrowPhase` always points **from body B toward body A** (from the second argument toward the first). Positional correction pushes A in the normal direction, B in the opposite direction.
- Broad-phase is conservative: false positives are expected. Narrow-phase provides the ground truth.

## Edge Cases

- **Tunneling**: No continuous collision detection (CCD). At large `dt` or high velocity, a thin collider can be skipped entirely. A body moving faster than its own diameter per frame will tunnel through walls.
- **Very large `dt`**: Position is updated as `position += velocity * dt`. A single large dt (e.g. tab unfocus and refocus) causes a large position jump. Consider capping dt at the call site.
- **Zero `dt`**: Gravity still accumulates velocity (`velocity[1] -= 9.81 * 0 = 0`) but position doesn't change. No collision issues.
- **Parallel capsule segments**: The capsule-capsule closest-point algorithm computes the denominator `dot(d1, d1) - dot(d1,d2)^2 / dot(d2,d2)`. When segments are parallel, the denominator is ≤ `1e-10` and `paramS` defaults to 0. This is correct but means only one pair of endpoints is tested.
- **Static vs static collision**: Returns early after `onOverlap` callback. No positional or velocity change. If two static bodies are placed overlapping at creation, they stay overlapping forever.
- **Mesh rotation in narrow phase**: `MeshHitbox` uses an axis-aligned box in narrow-phase tests. If the parent object is rotated, the narrow-phase treats the collision box as axis-aligned regardless. This produces incorrect collision normals for rotated mesh objects.
- **Collision layer map**: Pairs are only tested within the same layer (or between configured layer pairs). Objects in different, non-paired layers never collide, even if they visually overlap.
- **Degenerate collision normal** (zero length): If the narrow-phase returns a near-zero normal (e.g. two perfectly concentric spheres), the impulse direction is undefined. The denom check (`≤ 1e-10`) mitigates this for velocity but not for positional correction.
- **Mass = 0 on dynamic body**: `invMass = 1/mass` — division by zero. Static bodies use a separate `isStatic` flag to set `invMass = 0`. A non-static body with `mass = 0` would produce `Infinity` impulse magnitude.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| High velocity tunneling | Silent — body passes through collider |
| Large dt spike | Silent — large position jump, possible tunnel |
| Mass = 0 on non-static body | Silent (or Inf/NaN) — extreme impulse |
| Mesh rotation ignored in narrow phase | Silent — wrong collision normal for rotated meshes |
| Parallel capsule segments | Silent — one-sided contact only |
| Static+static overlap at creation | Silent — permanent interpenetration |
| Objects in unconfigured layer pairs | Silent — no collision detected |

## Test Scenarios

- **Gravity integration**: start with `velocity = [0,0,0]`, call `applyPhysics` with `dt = 1.0` — verify `velocity[1] ≈ -9.81` and `position[1] ≈ -9.81`.
- **Static body skips integration**: `isStatic = true`, apply physics — verify position and velocity unchanged.
- **`useGravity = false`**: apply physics — verify `velocity[1]` unchanged.
- **Sphere-sphere collision detection**: two spheres with overlapping positions — verify broadphase returns them as a candidate pair.
- **Sphere-sphere narrow phase**: compute expected penetration depth and normal — verify narrowPhase returns exact values.
- **Collision callback order**: register `onOverlap` and `onCollision` handlers, trigger collision — verify `onOverlap` fires before position changes, `onCollision` fires after.
- **Static+dynamic collision**: static floor, dynamic sphere falling onto it — verify sphere stops (velocity zeroed) and is not pushed below floor.
- **Static+static collision**: two overlapping static cubes — verify neither moves and `onOverlap` is called.
- **Mass-proportional correction**: two dynamic spheres, mass 1 and mass 3, colliding — verify lighter sphere moves 3× more than heavier.
- **Tunneling demonstration**: set velocity high enough to cross a wall in one frame — verify no collision detected (document expected behavior).
- **Parallel capsule degenerate**: two capsules with parallel vertical segments, overlap — verify no crash and a plausible normal is returned.
- **Zero `dt`**: call `applyPhysics(objects, 0)` — verify no NaN in position or velocity.
