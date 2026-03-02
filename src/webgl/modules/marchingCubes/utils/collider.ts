// src/modules/marchingCubes/utils/collider.ts

import { MarchingCubesResult } from '../types/MarchingCubesResult';

// WHY: CELL_SIZE=4 divides a 128-unit chunk into 32 cells per axis (32768
// total). For a 1×2×1 camera AABB the query touches at most 2×2×2 = 8 cells,
// which keeps the per-frame triangle tests in the low hundreds regardless of
// total mesh density. Larger cells mean fewer map entries but more triangles
// tested per query; 4 is a good balance for this voxel scale.
const CELL_SIZE = 4;

// Encode (ix, iy, iz) cell coordinates as a single 32-bit integer.
// Each axis gets 11 bits (0–2047), safely covering negative and large indices.
const AXIS_BITS = 11;
const AXIS_MASK = (1 << AXIS_BITS) - 1;
function cellKey(ix: number, iy: number, iz: number): number {
    return ((ix & AXIS_MASK)) |
           ((iy & AXIS_MASK) << AXIS_BITS) |
           ((iz & AXIS_MASK) << (2 * AXIS_BITS));
}

// ---------------------------------------------------------------------------
// SAT — AABB vs Triangle overlap test
// Reference: Akenine-Möller, "Fast 3D Triangle-Box Overlap Testing", 2001.
//
// WHY: The Separating Axis Theorem guarantees two convex shapes DON'T overlap
// iff there exists at least one axis along which their projections are
// disjoint. For AABB vs triangle, 13 axes suffice:
//   • 3 AABB face normals  (world X, Y, Z)
//   • 1 triangle face normal
//   • 9 cross products of AABB edge directions (x,y,z) with triangle edges (e0,e1,e2)
// ---------------------------------------------------------------------------

/** Returns true when the AABB and triangle DO NOT overlap on this axis. */
function separates(
    // Projection of the 3 triangle vertices onto the axis
    p0: number, p1: number, p2: number,
    // Projected radius of the AABB onto the axis
    r: number,
): boolean {
    const minP = p0 < p1 ? (p0 < p2 ? p0 : p2) : (p1 < p2 ? p1 : p2);
    const maxP = p0 > p1 ? (p0 > p2 ? p0 : p2) : (p1 > p2 ? p1 : p2);
    return minP > r || maxP < -r;
}

/**
 * SAT overlap test between an AABB and a triangle.
 * All coordinates in the same world-space frame.
 *
 * @param cx,cy,cz  AABB center
 * @param hx,hy,hz  AABB half-extents
 * @param ax,ay,az  Triangle vertex A
 * @param bx,by,bz  Triangle vertex B
 * @param ccx,ccy,ccz  Triangle vertex C
 * @returns true if the AABB and triangle overlap
 */
export function aabbTriangleOverlap(
    cx: number, cy: number, cz: number,
    hx: number, hy: number, hz: number,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    ccx: number, ccy: number, ccz: number,
): boolean {
    // Translate triangle into AABB-centred space so the AABB sits at the origin.
    const v0x = ax  - cx, v0y = ay  - cy, v0z = az  - cz;
    const v1x = bx  - cx, v1y = by  - cy, v1z = bz  - cz;
    const v2x = ccx - cx, v2y = ccy - cy, v2z = ccz - cz;

    // Triangle edge vectors
    const e0x = v1x - v0x, e0y = v1y - v0y, e0z = v1z - v0z;
    const e1x = v2x - v1x, e1y = v2y - v1y, e1z = v2z - v1z;
    const e2x = v0x - v2x, e2y = v0y - v2y, e2z = v0z - v2z;

    // --- 9 cross-product axes: (AABB edge) × (triangle edge) ---
    // AABB edges are the world axes: (1,0,0), (0,1,0), (0,0,1).
    // Cross products are computed analytically:
    //   (1,0,0) × (ex,ey,ez) = (0, -ez, ey)
    //   (0,1,0) × (ex,ey,ez) = (ez, 0, -ex)
    //   (0,0,1) × (ex,ey,ez) = (-ey, ex, 0)

    // (1,0,0) × e0 = (0, -e0z, e0y)
    {
        const r = hy * Math.abs(e0z) + hz * Math.abs(e0y);
        const p0 = -e0z * v0y + e0y * v0z;
        const p1 = -e0z * v1y + e0y * v1z;
        const p2 = -e0z * v2y + e0y * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (1,0,0) × e1
    {
        const r = hy * Math.abs(e1z) + hz * Math.abs(e1y);
        const p0 = -e1z * v0y + e1y * v0z;
        const p1 = -e1z * v1y + e1y * v1z;
        const p2 = -e1z * v2y + e1y * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (1,0,0) × e2
    {
        const r = hy * Math.abs(e2z) + hz * Math.abs(e2y);
        const p0 = -e2z * v0y + e2y * v0z;
        const p1 = -e2z * v1y + e2y * v1z;
        const p2 = -e2z * v2y + e2y * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,1,0) × e0 = (e0z, 0, -e0x)
    {
        const r = hx * Math.abs(e0z) + hz * Math.abs(e0x);
        const p0 = e0z * v0x - e0x * v0z;
        const p1 = e0z * v1x - e0x * v1z;
        const p2 = e0z * v2x - e0x * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,1,0) × e1
    {
        const r = hx * Math.abs(e1z) + hz * Math.abs(e1x);
        const p0 = e1z * v0x - e1x * v0z;
        const p1 = e1z * v1x - e1x * v1z;
        const p2 = e1z * v2x - e1x * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,1,0) × e2
    {
        const r = hx * Math.abs(e2z) + hz * Math.abs(e2x);
        const p0 = e2z * v0x - e2x * v0z;
        const p1 = e2z * v1x - e2x * v1z;
        const p2 = e2z * v2x - e2x * v2z;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,0,1) × e0 = (-e0y, e0x, 0)
    {
        const r = hx * Math.abs(e0y) + hy * Math.abs(e0x);
        const p0 = -e0y * v0x + e0x * v0y;
        const p1 = -e0y * v1x + e0x * v1y;
        const p2 = -e0y * v2x + e0x * v2y;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,0,1) × e1
    {
        const r = hx * Math.abs(e1y) + hy * Math.abs(e1x);
        const p0 = -e1y * v0x + e1x * v0y;
        const p1 = -e1y * v1x + e1x * v1y;
        const p2 = -e1y * v2x + e1x * v2y;
        if (separates(p0, p1, p2, r)) return false;
    }
    // (0,0,1) × e2
    {
        const r = hx * Math.abs(e2y) + hy * Math.abs(e2x);
        const p0 = -e2y * v0x + e2x * v0y;
        const p1 = -e2y * v1x + e2x * v1y;
        const p2 = -e2y * v2x + e2x * v2y;
        if (separates(p0, p1, p2, r)) return false;
    }

    // --- 3 AABB face-normal axes (world X, Y, Z) ---
    if (Math.max(v0x, v1x, v2x) < -hx || Math.min(v0x, v1x, v2x) > hx) return false;
    if (Math.max(v0y, v1y, v2y) < -hy || Math.min(v0y, v1y, v2y) > hy) return false;
    if (Math.max(v0z, v1z, v2z) < -hz || Math.min(v0z, v1z, v2z) > hz) return false;

    // --- Triangle face-normal axis ---
    // n = e0 × e1 (unnormalized — SAT works without normalizing)
    const nx = e0y * e1z - e0z * e1y;
    const ny = e0z * e1x - e0x * e1z;
    const nz = e0x * e1y - e0y * e1x;
    // All 3 triangle vertices project to the same value d on their face normal.
    const d = nx * v0x + ny * v0y + nz * v0z;
    const r = hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
    if (d > r || d < -r) return false;

    // No separating axis found — shapes overlap.
    return true;
}

// ---------------------------------------------------------------------------
// Möller-Trumbore ray-triangle intersection.
// Returns the ray parameter t (hit at origin + t*direction) or -1 if no hit.
// WHY: Möller-Trumbore avoids computing the plane equation explicitly; it
// works directly in barycentric coordinates using two cross products and two
// dot products, making it one of the cheapest exact ray-triangle tests.
// ---------------------------------------------------------------------------
function moellerTrumbore(
    ox: number, oy: number, oz: number,     // ray origin
    dx: number, dy: number, dz: number,     // ray direction (need not be unit)
    ax: number, ay: number, az: number,     // triangle vertex A (world space)
    bx: number, by: number, bz: number,     // triangle vertex B
    ccx: number, ccy: number, ccz: number,  // triangle vertex C
): number {
    const EPSILON = 1e-8;

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = ccx - ax, e2y = ccy - ay, e2z = ccz - az;

    // h = D × e2
    const hx = dy * e2z - dz * e2y;
    const hy = dz * e2x - dx * e2z;
    const hz = dx * e2y - dy * e2x;

    const a = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(a) < EPSILON) return -1; // ray parallel to triangle

    const f = 1.0 / a;
    const sx = ox - ax, sy = oy - ay, sz = oz - az;
    const u = f * (sx * hx + sy * hy + sz * hz);
    if (u < 0.0 || u > 1.0) return -1;

    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = f * (dx * qx + dy * qy + dz * qz);
    if (v < 0.0 || u + v > 1.0) return -1;

    const t = f * (e2x * qx + e2y * qy + e2z * qz);
    return t > EPSILON ? t : -1;
}

/** World-space triangle vertices (9 floats: A.xyz, B.xyz, C.xyz) and ray t. */
export type RaycastHit = { vertices: Float32Array; t: number };

// ---------------------------------------------------------------------------
// TriangleSpatialHash
// Accelerates AABB-vs-mesh overlap queries by bucketing triangles into a
// uniform grid of cells. Building the hash is O(triangles); querying is
// O(triangles in touched cells), typically a few hundred for a small AABB.
// ---------------------------------------------------------------------------
export class TriangleSpatialHash {
    private readonly cells: Map<number, number[]>; // cell key → triangle indices
    private readonly vertices: Float32Array;        // chunk-local XYZ, 9 floats per tri
    private readonly offX: number;
    private readonly offY: number;
    private readonly offZ: number;

    constructor(result: MarchingCubesResult, worldOffset: [number, number, number]) {
        this.vertices = result.vertices;
        [this.offX, this.offY, this.offZ] = worldOffset;
        this.cells = new Map();

        const v = result.vertices;
        const triCount = Math.floor(v.length / 9);

        for (let t = 0; t < triCount; t++) {
            const b = t * 9;
            const ax = v[b],     ay = v[b + 1], az = v[b + 2];
            const bx = v[b + 3], by = v[b + 4], bz = v[b + 5];
            const cx = v[b + 6], cy = v[b + 7], cz = v[b + 8];

            // AABB of the triangle in chunk-local space
            const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
            const minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
            const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);

            // Register this triangle in every cell its AABB covers.
            const ix0 = Math.floor(minX / CELL_SIZE), ix1 = Math.floor(maxX / CELL_SIZE);
            const iy0 = Math.floor(minY / CELL_SIZE), iy1 = Math.floor(maxY / CELL_SIZE);
            const iz0 = Math.floor(minZ / CELL_SIZE), iz1 = Math.floor(maxZ / CELL_SIZE);

            for (let ix = ix0; ix <= ix1; ix++) {
                for (let iy = iy0; iy <= iy1; iy++) {
                    for (let iz = iz0; iz <= iz1; iz++) {
                        const key = cellKey(ix, iy, iz);
                        let cell = this.cells.get(key);
                        if (!cell) { cell = []; this.cells.set(key, cell); }
                        cell.push(t);
                    }
                }
            }
        }
    }

    /**
     * Returns true if any triangle in this chunk's mesh overlaps the given
     * world-space AABB (defined by its min/max corners).
     */
    collidesWithAABB(
        worldMinX: number, worldMinY: number, worldMinZ: number,
        worldMaxX: number, worldMaxY: number, worldMaxZ: number,
    ): boolean {
        // Convert the query AABB to chunk-local space for cell lookup.
        const localMinX = worldMinX - this.offX;
        const localMinY = worldMinY - this.offY;
        const localMinZ = worldMinZ - this.offZ;
        const localMaxX = worldMaxX - this.offX;
        const localMaxY = worldMaxY - this.offY;
        const localMaxZ = worldMaxZ - this.offZ;

        // AABB center and half-extents in world space for the SAT test.
        const cX = (worldMinX + worldMaxX) * 0.5;
        const cY = (worldMinY + worldMaxY) * 0.5;
        const cZ = (worldMinZ + worldMaxZ) * 0.5;
        const hX = (worldMaxX - worldMinX) * 0.5;
        const hY = (worldMaxY - worldMinY) * 0.5;
        const hZ = (worldMaxZ - worldMinZ) * 0.5;

        const ix0 = Math.floor(localMinX / CELL_SIZE), ix1 = Math.floor(localMaxX / CELL_SIZE);
        const iy0 = Math.floor(localMinY / CELL_SIZE), iy1 = Math.floor(localMaxY / CELL_SIZE);
        const iz0 = Math.floor(localMinZ / CELL_SIZE), iz1 = Math.floor(localMaxZ / CELL_SIZE);

        // WHY: a triangle that spans multiple cells would be tested once per
        // overlapping cell. We deduplicate with a Set to run the SAT test at
        // most once per triangle. The Set stays small (hundreds of entries max
        // for a 1×2×1 AABB) so GC pressure is negligible.
        const tested = new Set<number>();
        const v = this.vertices;
        const offX = this.offX, offY = this.offY, offZ = this.offZ;

        for (let ix = ix0; ix <= ix1; ix++) {
            for (let iy = iy0; iy <= iy1; iy++) {
                for (let iz = iz0; iz <= iz1; iz++) {
                    const cell = this.cells.get(cellKey(ix, iy, iz));
                    if (!cell) continue;

                    for (let j = 0; j < cell.length; j++) {
                        const t = cell[j];
                        if (tested.has(t)) continue;
                        tested.add(t);

                        const b = t * 9;
                        // Transform vertices to world space by adding chunk offset.
                        if (aabbTriangleOverlap(
                            cX, cY, cZ, hX, hY, hZ,
                            v[b]     + offX, v[b + 1] + offY, v[b + 2] + offZ,
                            v[b + 3] + offX, v[b + 4] + offY, v[b + 5] + offZ,
                            v[b + 6] + offX, v[b + 7] + offY, v[b + 8] + offZ,
                        )) return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Cast a ray through the spatial hash and return the nearest triangle hit.
     *
     * WHY 3D DDA: instead of testing every triangle in the chunk we traverse
     * only the cells the ray passes through (in order of increasing t). This
     * keeps the test count proportional to the ray length ÷ CELL_SIZE rather
     * than the full mesh size, and lets us exit as soon as the nearest hit is
     * confirmed — no triangle behind the hit distance is ever tested.
     *
     * @param ox,oy,oz  Ray origin in world space.
     * @param dx,dy,dz  Ray direction (unit vector assumed; must not be zero).
     * @param maxDist   Maximum ray distance.
     */
    raycastTriangle(
        ox: number, oy: number, oz: number,
        dx: number, dy: number, dz: number,
        maxDist: number,
    ): RaycastHit | null {
        // Convert ray origin to chunk-local space for cell indexing.
        const lox = ox - this.offX;
        const loy = oy - this.offY;
        const loz = oz - this.offZ;

        // Starting cell.
        let cellX = Math.floor(lox / CELL_SIZE);
        let cellY = Math.floor(loy / CELL_SIZE);
        let cellZ = Math.floor(loz / CELL_SIZE);

        // Step direction (+1 or −1) per axis; 0 if ray is axis-parallel.
        const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
        const stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
        const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);

        // How much t increases when crossing one cell in each axis.
        const tDeltaX = stepX !== 0 ? CELL_SIZE / Math.abs(dx) : Infinity;
        const tDeltaY = stepY !== 0 ? CELL_SIZE / Math.abs(dy) : Infinity;
        const tDeltaZ = stepZ !== 0 ? CELL_SIZE / Math.abs(dz) : Infinity;

        // t at which the ray first crosses the next cell boundary per axis.
        const nextBX = stepX > 0 ? (cellX + 1) * CELL_SIZE : cellX * CELL_SIZE;
        const nextBY = stepY > 0 ? (cellY + 1) * CELL_SIZE : cellY * CELL_SIZE;
        const nextBZ = stepZ > 0 ? (cellZ + 1) * CELL_SIZE : cellZ * CELL_SIZE;
        let tMaxX = stepX !== 0 ? (nextBX - lox) / dx : Infinity;
        let tMaxY = stepY !== 0 ? (nextBY - loy) / dy : Infinity;
        let tMaxZ = stepZ !== 0 ? (nextBZ - loz) / dz : Infinity;

        let bestT = maxDist;
        let bestVerts: Float32Array | null = null;
        // WHY Set: a triangle spans multiple cells and would appear in each. We
        // deduplicate by triangle index so Möller-Trumbore runs at most once per
        // triangle even as we step across cell boundaries.
        const tested = new Set<number>();
        const v = this.vertices;
        const offX = this.offX, offY = this.offY, offZ = this.offZ;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // --- Test triangles in the current cell ---
            const cell = this.cells.get(cellKey(cellX, cellY, cellZ));
            if (cell) {
                for (let j = 0; j < cell.length; j++) {
                    const triIdx = cell[j];
                    if (tested.has(triIdx)) continue;
                    tested.add(triIdx);

                    const b = triIdx * 9;
                    const t = moellerTrumbore(
                        ox, oy, oz, dx, dy, dz,
                        v[b]     + offX, v[b + 1] + offY, v[b + 2] + offZ,
                        v[b + 3] + offX, v[b + 4] + offY, v[b + 5] + offZ,
                        v[b + 6] + offX, v[b + 7] + offY, v[b + 8] + offZ,
                    );
                    if (t > 0 && t < bestT) {
                        bestT = t;
                        bestVerts = new Float32Array([
                            v[b]     + offX, v[b + 1] + offY, v[b + 2] + offZ,
                            v[b + 3] + offX, v[b + 4] + offY, v[b + 5] + offZ,
                            v[b + 6] + offX, v[b + 7] + offY, v[b + 8] + offZ,
                        ]);
                    }
                }
            }

            // t at which the ray exits the current cell.
            const tExit = Math.min(tMaxX, tMaxY, tMaxZ);

            // WHY early exit: once bestT ≤ tExit, the hit point is inside or on
            // the boundary of the current cell. Every future cell has an entry t
            // greater than tExit, so no future triangle can produce a closer hit.
            // (Triangles spanning multiple cells were already tested via `tested`.)
            if (bestVerts !== null && bestT <= tExit) break;

            // Stop if the next cell is past the maximum distance.
            if (tExit > maxDist) break;

            // Advance to the next cell along the axis with the smallest tMax.
            if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
                tMaxX += tDeltaX; cellX += stepX;
            } else if (tMaxY <= tMaxZ) {
                tMaxY += tDeltaY; cellY += stepY;
            } else {
                tMaxZ += tDeltaZ; cellZ += stepZ;
            }
        }

        return bestVerts ? { vertices: bestVerts, t: bestT } : null;
    }
}
