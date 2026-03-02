// src/scene/world.ts

import { CHUNK_SIZE, WORLD_SIZE } from '../../../common/constants/constants';
import { Chunk } from './chunk';
import { FillFunction } from '../types/FillFunction';
import { RaycastHit } from '../utils/collider';
import { aabbInFrustum, extractFrustumPlanes, multiplyMat4 } from '../../../common/utils/math/frustum';

// Module-level typed arrays reused every frame to avoid per-frame GC pressure.
const VP_MATRIX = new Float32Array(16); // combined proj * view
const PLANES    = new Float32Array(24); // 6 planes × [nx, ny, nz, d]

// WHY slab method: the fastest ray-AABB test — 3 pairs of slab intersections,
// trivially reject if tNear > tFar or the box is entirely behind the ray.
// maxDist acts as an early-out so we skip chunks beyond the current best hit.
function rayHitsAABB(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    maxDist: number,
): boolean {
    let tNear = -Infinity, tFar = Infinity;

    // X slab
    if (Math.abs(dx) < 1e-10) {
        if (ox < minX || ox > maxX) return false;
    } else {
        let t1 = (minX - ox) / dx, t2 = (maxX - ox) / dx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tNear = Math.max(tNear, t1); tFar = Math.min(tFar, t2);
    }
    // Y slab
    if (Math.abs(dy) < 1e-10) {
        if (oy < minY || oy > maxY) return false;
    } else {
        let t1 = (minY - oy) / dy, t2 = (maxY - oy) / dy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tNear = Math.max(tNear, t1); tFar = Math.min(tFar, t2);
    }
    // Z slab
    if (Math.abs(dz) < 1e-10) {
        if (oz < minZ || oz > maxZ) return false;
    } else {
        let t1 = (minZ - oz) / dz, t2 = (maxZ - oz) / dz;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tNear = Math.max(tNear, t1); tFar = Math.min(tFar, t2);
    }

    return tNear <= tFar && tFar >= 0 && tNear <= maxDist;
}

export class World {
    private readonly chunks: Chunk[];
    private readonly gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext, fillFn: FillFunction, isolevel: number) {
        this.gl = gl;
        this.chunks = [];

        for (let cz = 0; cz < WORLD_SIZE; cz++) {
            for (let cx = 0; cx < WORLD_SIZE; cx++) {
                this.chunks.push(new Chunk(gl, { cx, cy: 0, cz }, fillFn, isolevel));
            }
        }
    }

    private idx(cx: number, cz: number): number {
        return cx + WORLD_SIZE * cz;
    }

    getChunk(cx: number, cz: number): Chunk {
        return this.chunks[this.idx(cx, cz)];
    }

    /**
     * Returns true if the given world-space AABB overlaps any triangle in any
     * chunk's mesh. Each chunk is first tested against its own world-space
     * bounds (cheap rejection) before the expensive per-triangle SAT test.
     */
    collidesWithAABB(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): boolean {
        for (const chunk of this.chunks) {
            const [ox, oy, oz] = chunk.worldOffset;
            // WHY: reject chunks whose bounds don't overlap the query AABB before
            // delegating to the per-triangle spatial hash. This skips 15 of 16
            // chunks for a typical camera position, reducing queries to O(1) chunks.
            if (maxX < ox || minX > ox + CHUNK_SIZE ||
                maxY < oy || minY > oy + CHUNK_SIZE ||
                maxZ < oz || minZ > oz + CHUNK_SIZE) continue;

            if (chunk.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ)) return true;
        }
        return false;
    }

    /**
     * Cast a ray through the world and return the nearest hit triangle.
     * Each chunk is pre-rejected with a ray-AABB slab test before the
     * per-triangle DDA traversal is invoked.
     */
    raycastTriangle(
        ox: number, oy: number, oz: number,
        dx: number, dy: number, dz: number,
        maxDist: number,
    ): RaycastHit | null {
        let best: RaycastHit | null = null;

        for (const chunk of this.chunks) {
            const [cox, coy, coz] = chunk.worldOffset;
            // WHY slab test: reject chunks whose AABB the ray misses entirely.
            // This reduces per-frame DDA calls from 16 to the 1–2 chunks the
            // ray actually passes through, regardless of world size.
            if (!rayHitsAABB(ox, oy, oz, dx, dy, dz,
                cox, coy, coz,
                cox + CHUNK_SIZE, coy + CHUNK_SIZE, coz + CHUNK_SIZE,
                best ? best.t : maxDist)) continue;

            const hit = chunk.raycastTriangle(ox, oy, oz, dx, dy, dz,
                best ? best.t : maxDist);
            if (hit) best = hit;
        }
        return best;
    }

    /**
     * Modify the scalar field of every chunk whose AABB overlaps the sculpt
     * sphere, then rebuild those chunks' meshes.
     *
     * WHY sphere-AABB test: a simple per-axis range check is a conservative
     * but O(1) early-out. The sphere of radius `r` centred at (wx,wy,wz)
     * cannot reach chunk [ox, ox+CHUNK_SIZE] unless wx±r crosses that interval
     * on every axis simultaneously.
     */
    sculptAt(wx: number, wy: number, wz: number, radius: number, delta: number): void {
        for (const chunk of this.chunks) {
            const [ox, oy, oz] = chunk.worldOffset;
            if (wx + radius < ox || wx - radius > ox + CHUNK_SIZE ||
                wy + radius < oy || wy - radius > oy + CHUNK_SIZE ||
                wz + radius < oz || wz - radius > oz + CHUNK_SIZE) continue;

            chunk.sculptAt(wx, wy, wz, radius, delta);
        }
    }

    render(
        attributeLocation: number,
        chunkOffsetLocation: WebGLUniformLocation,
        viewMatrix: Float32Array,
        projMatrix: Float32Array,
    ): void {
        // WHY: recompute once per frame so the planes track camera movement.
        // VP_MATRIX and PLANES are module-level typed arrays; no allocation here.
        multiplyMat4(projMatrix, viewMatrix, VP_MATRIX);
        extractFrustumPlanes(VP_MATRIX, PLANES);

        for (const chunk of this.chunks) {
            const [ox, oy, oz] = chunk.worldOffset;
            // WHY: skip chunks whose AABB is entirely outside any frustum plane.
            // Conservative test (no false negatives). Typically reduces draw calls
            // from 16 to the ~4–8 chunks visible at any camera position.
            if (!aabbInFrustum(PLANES, ox, oy, oz, ox + CHUNK_SIZE, oy + CHUNK_SIZE, oz + CHUNK_SIZE)) continue;
            this.gl.uniform3fv(chunkOffsetLocation, chunk.worldOffset);
            chunk.draw(attributeLocation);
        }
    }

    destroy(): void {
        for (const chunk of this.chunks) chunk.destroy();
    }
}
