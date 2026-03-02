// src/common/utils/math/frustum.ts
//
// Pure math utilities for frustum extraction and AABB-frustum testing.
// All matrices are 4×4 column-major Float32Array (WebGL convention).
// Element at (row r, column c): index = c*4 + r.

/**
 * Writes the product a * b into `out` (column-major 4×4 multiply).
 * out[col*4+row] = Σ_k  a[k*4+row] * b[col*4+k]
 */
export function multiplyMat4(
    a: Float32Array,
    b: Float32Array,
    out: Float32Array,
): void {
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
            out[col * 4 + row] = sum;
        }
    }
}

/**
 * Gribb-Hartmann frustum plane extraction.
 *
 * `m` is the combined clip matrix (proj * view), stored column-major.
 * Writes 6 planes into `out` as flat [nx,ny,nz,d, nx,ny,nz,d, …]:
 *   [0] left, [1] right, [2] bottom, [3] top, [4] near, [5] far.
 *
 * A world-space point p is inside plane i when:
 *   out[i*4]*p.x + out[i*4+1]*p.y + out[i*4+2]*p.z + out[i*4+3] >= 0
 *
 * WHY: extracting planes from the combined matrix in one pass is O(1) and
 * eliminates per-chunk matrix work.
 */
export function extractFrustumPlanes(m: Float32Array, out: Float32Array): void {
    // Row r of a column-major matrix: [m[r], m[4+r], m[8+r], m[12+r]]
    const r0x=m[0],  r0y=m[4],  r0z=m[8],  r0w=m[12];
    const r1x=m[1],  r1y=m[5],  r1z=m[9],  r1w=m[13];
    const r2x=m[2],  r2y=m[6],  r2z=m[10], r2w=m[14];
    const r3x=m[3],  r3y=m[7],  r3z=m[11], r3w=m[15];
    // left:   row3 + row0
    out[ 0]=r3x+r0x; out[ 1]=r3y+r0y; out[ 2]=r3z+r0z; out[ 3]=r3w+r0w;
    // right:  row3 - row0
    out[ 4]=r3x-r0x; out[ 5]=r3y-r0y; out[ 6]=r3z-r0z; out[ 7]=r3w-r0w;
    // bottom: row3 + row1
    out[ 8]=r3x+r1x; out[ 9]=r3y+r1y; out[10]=r3z+r1z; out[11]=r3w+r1w;
    // top:    row3 - row1
    out[12]=r3x-r1x; out[13]=r3y-r1y; out[14]=r3z-r1z; out[15]=r3w-r1w;
    // near:   row3 + row2
    out[16]=r3x+r2x; out[17]=r3y+r2y; out[18]=r3z+r2z; out[19]=r3w+r2w;
    // far:    row3 - row2
    out[20]=r3x-r2x; out[21]=r3y-r2y; out[22]=r3z-r2z; out[23]=r3w-r2w;
}

/**
 * Returns false if the AABB [minX..maxX, minY..maxY, minZ..maxZ] is entirely
 * outside any single frustum plane (conservative, zero false negatives).
 *
 * WHY p-vertex: for each plane we pick the AABB corner most aligned with the
 * plane normal. If that corner is still outside, every corner is → safe to cull.
 * O(6) comparisons per AABB.
 *
 * `planes` must be the 24-element array produced by extractFrustumPlanes().
 */
export function aabbInFrustum(
    planes: Float32Array,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
): boolean {
    for (let i = 0; i < 6; i++) {
        const nx = planes[i * 4];
        const ny = planes[i * 4 + 1];
        const nz = planes[i * 4 + 2];
        const d  = planes[i * 4 + 3];
        if (nx * (nx > 0 ? maxX : minX)
          + ny * (ny > 0 ? maxY : minY)
          + nz * (nz > 0 ? maxZ : minZ)
          + d < 0) return false;
    }
    return true;
}
