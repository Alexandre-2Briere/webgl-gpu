# Hitbox

## Role

Defines the collision shapes used by the physics system. Each hitbox is a mathematical volume attached to a GameObject. The shape hierarchy maps to the narrow-phase collision algorithms: the type of two hitboxes determines which test function is called.

## Key Concepts

- **Hitbox3D (base)**: Stores an `orientation` matrix (column-major 4×4 transform, no scale) representing the hitbox's world-space position and rotation. Updated each frame via `updateOrientation()`.
- **CubeHitbox**: Oriented Bounding Box (OBB). Defined by `halfExtents [x, y, z]`. Follows the rigidbody's full rotation.
- **SphereHitbox**: Radially symmetric. Defined by `radius`. Rotation is irrelevant.
- **CapsuleHitbox**: A cylinder capped with hemispheres. Defined by `radius` and total `height` (including the two hemispheres). The centerline segment runs along the local Y-axis. `halfSegmentLength = max(0, height/2 - radius)`.
- **MeshHitbox**: Axis-Aligned Bounding Box (AABB). Bounds are computed from vertex data at construction time and never updated. Does **not** rotate with the object — only translation is applied.

## Invariants

- `updateOrientation(pos, quat)` must be called after every transform change. The `orientation` matrix is the source of truth for world-space shape placement.
- The `orientation` matrix encodes only position and rotation (no scale). World center is always at `[orientation[12], orientation[13], orientation[14]]`.
- Offset translation and offset rotation (yaw/pitch) are applied in local space, then composed with the parent quaternion. Offset rotation uses only two Euler angles (yaw, pitch); roll is zero.
- `MeshHitbox` bounds are immutable after construction. If the mesh is deformed after construction, the hitbox will be stale.
- Capsule `halfSegmentLength` is clamped to ≥ 0. A capsule whose `height ≤ 2 * radius` has no centerline segment and behaves like a sphere of the same radius.
- All hitbox subclasses must implement `clone()` — used when copying GameObjects.

## Edge Cases

- **Degenerate capsule** (`height ≤ 2 * radius`): `halfSegmentLength = 0`, both segment endpoints collapse to the center. The capsule is mathematically equivalent to a sphere. Collision tests should handle this gracefully (closest point on segment = center).
- **MeshHitbox and rotation**: `MeshHitbox` stores only translation from `orientation`. If the parent object rotates, the AABB stays axis-aligned but the object's visual mesh rotates. The hitbox and mesh diverge for any non-zero rotation.
- **Zero halfExtents on CubeHitbox**: A cube with `halfExtents [0,0,0]` is a point. SAT tests can still run but penetration depth will be zero for touching-but-not-overlapping scenarios. Normals may be degenerate.
- **Offset rotation accumulation**: Each `updateOrientation()` call rebuilds the orientation from scratch. There is no accumulation error from repeated calls.
- **Offset with large translation**: The offset translation is rotated by the parent quaternion. A large offset at a rapidly rotating object can cause the hitbox to lag one frame behind the visual if `updateOrientation()` is not called after every rotation step.
- **Non-unit parent quaternion**: `updateOrientation()` uses `rotateByQuat()` which assumes a unit quaternion. A non-unit quaternion will scale the offset translation and produce an incorrect world position.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| `updateOrientation()` not called after transform change | Silent — hitbox lags behind renderable |
| MeshHitbox on rotating object | Silent — AABB stays axis-aligned, collision diverges from visual |
| Degenerate capsule not handled in narrow phase | May produce NaN depth or zero normal |
| Non-unit parent quaternion | Silent — offset translation scaled incorrectly |
| `clone()` not implemented on custom subclass | Runtime error when copying the owning GameObject |

## Test Scenarios

- **CubeHitbox orientation**: set parent at `[1,2,3]` with identity rotation, call `updateOrientation()` — verify center is `[1,2,3]`.
- **CubeHitbox with offset**: set offset translation `[1,0,0]`, identity rotation — verify center is `[2,2,3]`.
- **CubeHitbox offset at 90° Y rotation**: offset `[1,0,0]`, rotate 90° around Y — verify center shifts along Z instead of X.
- **SphereHitbox center**: verify center matches world position regardless of rotation.
- **Capsule at minimum height** (`height = 2 * radius`): verify `halfSegmentLength = 0`, both endpoints equal the center.
- **Capsule below minimum height** (`height < 2 * radius`): verify `halfSegmentLength` is clamped to 0, no negative value.
- **MeshHitbox bounds**: construct with known vertex data, verify `halfExtents` match the expected min/max extents.
- **MeshHitbox with override**: supply `MeshHitboxOverride`, verify `halfExtents` use override values, not computed ones.
- **MeshHitbox rotation ignored**: rotate parent object, call `updateOrientation()` — verify hitbox center updates but `halfExtents` stay axis-aligned.
- **clone()**: clone each hitbox subclass, verify the clone has the same properties and is a distinct object.
