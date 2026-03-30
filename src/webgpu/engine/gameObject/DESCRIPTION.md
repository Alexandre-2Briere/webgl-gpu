# GameObject

## Role

The top-level game entity. Composes a visual (renderable), an optional collision volume (hitbox), and optional physics state (rigidbody) into a single object with a unified transform. It is the authoritative owner of `position`, `quaternion`, and `scale` — all subsystems synchronize from it, not the other way around (except after a physics step).

## Key Concepts

- **Transform authority**: `position`, `quaternion`, and `scale` live on `GameObject`. Any mutation (e.g. `setPosition`, `rotate`) immediately propagates to the renderable and hitbox via `_applyTransform()`.
- **Physics sync cycle**:
  1. Before physics: `syncToPhysics()` copies the GameObject transform into the rigidbody, applying the rigidbody offset.
  2. After collisions: `syncFromPhysics()` reads the rigidbody's updated position/quaternion back and writes them to the GameObject (and thus the renderable and hitbox).
- **Rigidbody offset**: The rigidbody's physics center may be offset from the renderable's visual origin (e.g. a character whose collision body is shifted downward). The offset is expressed in local space and is rotated by the GameObject's current quaternion when converting to world space.
- **IGameObject interface**: The engine operates on `IGameObject` — the interface, not the concrete class. This allows custom implementations of game entities without subclassing `GameObject`.

## Invariants

- The renderable is set at construction and never replaced.
- The hitbox and rigidbody references are nullable but immutable after construction.
- After every transform mutation, the renderable's model matrix and the hitbox's world orientation are updated in the same call.
- `syncFromPhysics()` applies the **inverse** offset rotation to recover the visual position from the physics position. If the rigidbody offset is `[0,0,0]`, this is a no-op.
- Static rigidbodies (`isStatic = true`) are never moved by physics. `syncFromPhysics()` still reads from them but the values are unchanged.

## Edge Cases

- **Non-zero rigidbody offset at 90°/180° rotations**: The offset is rotated by the object's quaternion. At cardinal angles the result should be exact, but floating-point errors can accumulate over many rotation steps.
- **Zero quaternion**: If the quaternion is `[0,0,0,0]` (not a valid rotation), `rotateByQuat` will produce a zero vector. All transforms derived from it become invalid. Quaternion must always be a unit quaternion.
- **Offset-only rigidbody (no hitbox on rigidbody)**: A rigidbody with `hitbox = null` still integrates velocity and gravity but skips collision detection. The object falls through the world silently.
- **Hitbox without rigidbody**: A hitbox with no rigidbody means the object participates in collision callbacks (`onOverlap`, `onCollision`) but is never moved by physics. Useful for trigger volumes.
- **Scale applied to hitbox**: Scale is applied to the renderable but hitbox extents are typically defined independently and are not scaled by the GameObject scale. A scale change that visually grows the mesh will not automatically grow the hitbox.
- **Mutating transform mid-physics-step**: If `setPosition()` is called while `applyPhysics` / `applyCollisions` is running (e.g. inside an `onCollision` callback), it bypasses the physics sync cycle. The change will be overwritten by the next `syncFromPhysics()`.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| Non-unit quaternion | Silent — scaled/sheared transforms, broken normals |
| `setPosition()` inside collision callback | Silent — overwritten by `syncFromPhysics()` |
| Scale mismatch between mesh and hitbox | Silent — visual/collision disagreement |
| Missing rigidbody, object should fall | Silent — no gravity applied |
| Rigidbody offset wrong sign | Silent — visual and physics centers diverge |

## Test Scenarios

- **Transform propagation**: call `setPosition(1, 2, 3)` — verify renderable model matrix and hitbox orientation both reflect the new position.
- **syncToPhysics / syncFromPhysics round-trip**: set position, call `syncToPhysics()`, modify rigidbody position by `delta`, call `syncFromPhysics()` — verify GameObject position equals original + delta.
- **Rigidbody offset at identity quaternion**: set offset `[1, 0, 0]`, call `syncToPhysics()` — verify rigidbody position is `gameObject.position + [1, 0, 0]`.
- **Rigidbody offset at 90° Y rotation**: set offset `[1, 0, 0]`, rotate 90° around Y — verify rigidbody position is `gameObject.position + [0, 0, -1]` (rotated offset).
- **Static rigidbody**: `isStatic = true`, call `syncFromPhysics()` — verify GameObject position is unchanged.
- **No hitbox, no rigidbody**: create GameObject with renderable only, call `syncToPhysics()` and `syncFromPhysics()` — verify no throw.
- **Hitbox without rigidbody**: verify `updateOrientation()` is called on the hitbox but no physics integration occurs.
- **Quaternion normalization**: set a non-unit quaternion, verify whether the engine normalizes it or propagates the invalid state.
