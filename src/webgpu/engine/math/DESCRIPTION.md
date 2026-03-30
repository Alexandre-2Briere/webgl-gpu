# Math

## Role

Pure, stateless math utilities for 3D game engine operations. No GPU interaction. Used throughout the engine for transform construction, physics calculations, hitbox geometry, and camera math. Three files: vectors (`vec.ts`), matrices (`mat.ts`), quaternions (`quat.ts`).

## Key Concepts

- **Column-major matrices**: All 4×4 matrices use column-major layout (WebGPU/OpenGL convention). Element at row `i`, column `j` is at index `j*4 + i`. Translation lives at indices 12, 13, 14.
- **Quaternions `[x, y, z, w]`**: Scalar-last format. W is the real part. All quaternion functions assume unit quaternions unless otherwise noted.
- **YXZ Euler order**: `yawPitchRollToQuat` applies yaw (Y-axis) first, then pitch (X-axis), then roll (Z-axis). This matches typical FPS camera convention.
- **Degenerate vector fallback**: `norm3` and `safeNorm3` both return `[0, 1, 0]` on zero-length input. This is a safe default for normal vectors but may mask bugs if called with non-normal input.
- **fastInvSqrt**: Quake III-style 64-bit inverse square root. Uses a 64-bit magic constant with one Newton-Raphson iteration. Approximate — tolerance ~1e-6 relative error. Used in `safeNorm3`.

## Invariants

- All matrix functions write into a caller-supplied `Float32Array` (`out` parameter). No heap allocation inside math functions.
- `makeTransformMatrix(position, quaternion, scale, out)` assumes the quaternion is unit length. A non-unit quaternion will scale the resulting rotation columns, producing a matrix that is not a pure TRS.
- `dot(a, b)` throws if `a.length !== b.length`. All other vector functions assume matching dimensions without validation.
- `cross3` has no length validation — calling it with zero-length vectors produces `[0, 0, 0]`. Normalizing the result will produce `[0, 1, 0]` (fallback), not an error.
- `mulQuat(a, b)` is the Hamilton product (`a * b`), not commutative. Order matters: `mulQuat(parent, child)` applies `child` rotation first (local), then `parent` (world).
- `rotateByQuat(v, q)` uses the sandwich product `q * [v, 0] * q⁻¹`. Assumes unit `q`. A non-unit quaternion scales the vector by `|q|²`.

## Edge Cases

- **Zero vector normalization**: `norm3([0,0,0])` returns `[0,1,0]`. `safeNorm3([0,0,0])` also returns `[0,1,0]`. This is a convention, not an error — callers must be aware the fallback direction is arbitrary.
- **Near-zero vector normalization**: `safeNorm3` threshold is `sq < 1e-12`. Vectors with squared length between `0` and `1e-12` return the fallback, not a normalized vector.
- **Non-unit quaternion in `makeTransformMatrix`**: Scale columns of the rotation block are scaled by `|q|`. The resulting matrix has shear or scale baked in. No warning is emitted.
- **Non-unit quaternion in `rotateByQuat`**: The rotated vector is scaled by `|q|²`. A quaternion with magnitude 2 would double the vector's length.
- **`fastInvSqrt` on zero**: Input `x = 0` would produce `1/0 = Infinity` in a naive implementation. The 64-bit bit-hack starts with a finite guess and one Newton step; behavior for `x ≤ 0` is undefined.
- **`dot` length mismatch**: Throws. This is the only math function that validates its inputs. The throw message should be tested.
- **Gimbal lock via Euler composition**: `yawPitchRollToQuat` with pitch = ±90° causes gimbal lock (yaw and roll become the same axis). The Camera clamps pitch to ±89° to avoid this, but the math function itself does not.
- **Floating-point quaternion drift**: After many `mulQuat` compositions, the quaternion may drift from unit length. The engine does not re-normalize automatically. Physics-driven objects that rotate every frame may accumulate error over time.
- **TRS matrix with zero scale**: `makeTransformMatrix` with scale `[0, 0, 0]` produces a zero rotation block. The matrix maps all points to the translation position. Not an error, but the resulting matrix is singular.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| Non-unit quaternion in `makeTransformMatrix` | Silent — scaled/sheared matrix |
| Non-unit quaternion in `rotateByQuat` | Silent — scaled output vector |
| `dot` length mismatch | Loud — throws |
| Zero vector normalized | Silent — returns `[0,1,0]` fallback |
| `fastInvSqrt(0)` | Silent — undefined behavior (likely Inf/NaN) |
| Quaternion drift over many frames | Silent — gradual rotation error |

## Test Scenarios

- **norm3 zero vector**: `norm3([0,0,0])` → `[0,1,0]`.
- **norm3 unit vector**: `norm3([1,0,0])` → `[1,0,0]` (unchanged).
- **safeNorm3 near-zero**: `safeNorm3([1e-7, 0, 0])` → `[0,1,0]` (below threshold).
- **cross3 orthogonality**: `cross3([1,0,0],[0,1,0])` → `[0,0,1]`; verify handedness.
- **cross3 parallel vectors**: `cross3([1,0,0],[1,0,0])` → `[0,0,0]`.
- **dot length mismatch**: `dot([1,2],[1,2,3])` → throws.
- **mulQuat identity**: `mulQuat([0,0,0,1], q)` → `q` for any unit `q`.
- **mulQuat non-commutativity**: verify `mulQuat(a,b) ≠ mulQuat(b,a)` for non-collinear rotations.
- **rotateByQuat**: rotate `[1,0,0]` by 90° around Y → expect `[0,0,-1]` (or `[0,0,1]` depending on convention — document the expected result).
- **yawPitchRollToQuat identity**: `yawPitchRollToQuat(0,0,0)` → `[0,0,0,1]`.
- **makeTransformMatrix identity**: identity quaternion, zero translation, uniform scale 1 → identity matrix.
- **makeTransformMatrix TRS round-trip**: build matrix from known TRS, verify translation is at indices 12–14, verify scale is correct.
- **fastInvSqrt accuracy**: compare `fastInvSqrt(4)` with `1/Math.sqrt(4) = 0.5` — verify relative error < 1e-4.
- **Column-major layout**: call `makeTransformMatrix` with translation `[1,2,3]` — verify `out[12]=1, out[13]=2, out[14]=3`.
