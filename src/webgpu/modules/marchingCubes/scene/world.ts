// src/scene/world.ts

import { CHUNK_SIZE, CHUNK_RENDER_DISTANCE, CHUNK_PREGENERATION_DISTANCE, CHUNK_WORLD_SIZE_XZ } from '../../../common/constants/constants';
import { Chunk, isChunkCached, clearLegacyCaches } from './chunk';
import { FillFunction } from '../types/FillFunction';
import { ChunkCoord } from '../types/ChunkCoord';
import { RaycastHit } from '../utils/collider';
import { Camera } from '../../../common/utils/camera/camera';
import { Vertex3 } from '../../../common/types/Vertex';

function chunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
}

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
    private readonly device: GPUDevice;
    private readonly chunkBindGroupLayout: GPUBindGroupLayout;
    private readonly fillFn: FillFunction;
    // WHY: underground chunks (cy < 0) use a separate fill function (typically a
    // constant solid value) so they start with no geometry but can be sculpted.
    private readonly undergroundFillFn: FillFunction | undefined;
    private readonly isolevel: number;

    // Live chunk map keyed by "cx,cy,cz". Chunks are added progressively,
    // one per frame, so the map grows from empty to a full render-distance square.
    private readonly chunkMap: Map<string, Chunk> = new Map();

    // ── Normal load queue ─────────────────────────────────────────────────────
    // Ordered list of chunk coords still pending creation. Rebuilt whenever
    // the camera crosses a chunk boundary; FOV chunks are placed first.
    private loadQueue: ChunkCoord[] = [];

    // ── Pre-generation queue ──────────────────────────────────────────────────
    // Built once on the very first update() call. Contains every coord within
    // CHUNK_PREGENERATION_DISTANCE of the starting camera chunk, sorted
    // nearest-first. Inner coords (within CHUNK_RENDER_DISTANCE) become full
    // GPU chunks; outer coords are computed and persisted to localStorage only.
    // WHY: cache all surrounding terrain on first visit so that subsequent
    // sessions load the entire area from localStorage near-instantly.
    private pregenerationQueue: ChunkCoord[] = [];
    private pregenerationTotal: number = 0;
    private pregenerationStarted: boolean = false;

    // Camera chunk coords from the most recent update() call, used by
    // processNextChunk() to decide inner vs outer chunk treatment.
    private currentCamCX: number = 0;
    private currentCamCZ: number = 0;

    // Last camera chunk coords — detect chunk boundary crossings.
    private lastCamCX: number = NaN;
    private lastCamCZ: number = NaN;

    constructor(
        device: GPUDevice,
        chunkBindGroupLayout: GPUBindGroupLayout,
        fillFn: FillFunction,
        isolevel: number,
        undergroundFillFn?: FillFunction,
    ) {
        this.device = device;
        this.chunkBindGroupLayout = chunkBindGroupLayout;
        this.fillFn = fillFn;
        this.undergroundFillFn = undergroundFillFn;
        this.isolevel = isolevel;
        // WHY: run once at startup to remove v1 vertex-array entries so the
        // new v2 scalar-field format has room in the localStorage quota.
        clearLegacyCaches();
        // WHY: no chunks created here. The first update() call triggers the
        // initial queue build and begins loading the nearest visible chunk first.
    }

    /**
     * Called once per frame from the renderer.
     *
     * 1. Detects if the camera has moved into a new chunk since the last call.
     * 2. On the very first call: builds the pre-generation queue (all coords
     *    within CHUNK_PREGENERATION_DISTANCE, sorted nearest-first).
     * 3. On every chunk-boundary crossing: rebuilds the normal load queue
     *    (FOV chunks first within CHUNK_RENDER_DISTANCE).
     * 4. Pops one entry from the active queue and either creates a full GPU
     *    chunk (inner) or caches headlessly to localStorage (outer).
     */
    update(camera: Camera): void {
        const camCX = Math.floor(camera.positionX / CHUNK_WORLD_SIZE_XZ);
        const camCZ = Math.floor(camera.positionZ / CHUNK_WORLD_SIZE_XZ);
        const camCY = 0; // single Y layer

        this.currentCamCX = camCX;
        this.currentCamCZ = camCZ;

        if (camCX !== this.lastCamCX || camCZ !== this.lastCamCZ) {
            // First update (NaN check): build the pre-generation queue once.
            if (isNaN(this.lastCamCX)) {
                this.buildPregenerationQueue(camCX, camCY, camCZ);
            }

            this.lastCamCX = camCX;
            this.lastCamCZ = camCZ;

            // WHY: only rebuild on chunk boundary crossings. Sorting up to
            // (2R+1)² entries every frame would waste CPU for no gain — the
            // distance order only changes when the camera enters a new chunk.
            this.rebuildLoadQueue(camCX, camCY, camCZ);
        }

        this.processNextChunk();
    }

    /**
     * Builds the one-time pre-generation queue centered on the starting chunk.
     * Sorted nearest-first so the player's immediate surroundings appear first,
     * giving the loading bar a sense of progression from inside out.
     */
    private buildPregenerationQueue(camCX: number, camCY: number, camCZ: number): void {
        const R = CHUNK_PREGENERATION_DISTANCE;
        const coords: ChunkCoord[] = [];

        for (let dz = -R; dz <= R; dz++) {
            for (let dx = -R; dx <= R; dx++) {
                coords.push({ cx: camCX + dx, cy: camCY, cz: camCZ + dz });
            }
        }

        coords.sort((a, b) => {
            const da = (a.cx - camCX) ** 2 + (a.cz - camCZ) ** 2;
            const db = (b.cx - camCX) ** 2 + (b.cz - camCZ) ** 2;
            return da - db;
        });

        this.pregenerationQueue = coords;
        this.pregenerationTotal = coords.length;
        this.pregenerationStarted = true;
    }

    /**
     * Rebuilds the normal load queue for the given camera chunk.
     * All chunks within CHUNK_RENDER_DISTANCE are queued and sorted purely by
     * squared distance — every direction is treated equally so all chunks get
     * cached to localStorage at the same rate regardless of camera orientation.
     */
    private rebuildLoadQueue(camCX: number, camCY: number, camCZ: number): void {
        const R = CHUNK_RENDER_DISTANCE;
        const pending: Array<{ coord: ChunkCoord; dist2: number }> = [];

        for (let dz = -R; dz <= R; dz++) {
            for (let dx = -R; dx <= R; dx++) {
                const cx = camCX + dx;
                const cz = camCZ + dz;
                const dist2 = dx * dx + dz * dz;

                // Surface layer (cy = 0).
                if (!this.chunkMap.has(chunkKey(cx, camCY, cz))) {
                    pending.push({ coord: { cx, cy: camCY, cz }, dist2 });
                }

                // Underground layer (cy = -1). Loaded after all surface chunks
                // (dist2 offset pushes them past the worst surface priority).
                // WHY: underground chunks start fully solid (no geometry) and only
                // become visible when the player sculpts into them, so they can
                // safely load after the walkable surface is in place.
                if (this.undergroundFillFn && !this.chunkMap.has(chunkKey(cx, -1, cz))) {
                    pending.push({ coord: { cx, cy: -1, cz }, dist2: dist2 + (2 * R + 1) * (2 * R + 1) });
                }
            }
        }

        pending.sort((a, b) => a.dist2 - b.dist2);
        this.loadQueue = pending.map(p => p.coord);
    }

    /**
     * Pops entries from the active queue and creates GPU chunks for all of them,
     * ensuring every chunk ends up in both chunkMap and localStorage.
     *
     * Pre-generation phase (pregenerationQueue not empty):
     *   Every coord — regardless of distance or camera orientation — becomes a
     *   full GPU Chunk. The Chunk constructor handles localStorage: on a cache
     *   hit it deserializes and uploads (fast); on a cache miss it runs marching
     *   cubes and persists the result (slow).
     *   WHY time-budget batching: cache hits are cheap (~2–5 ms each), so we
     *   drain as many as possible within a 10 ms window per frame. Cache misses
     *   are expensive (marching cubes can exceed 20 ms), so we always stop after
     *   one to keep the main thread responsive.
     *
     * Normal phase (pregenerationQueue empty):
     *   One GPU chunk per frame from the distance-sorted load queue.
     */
    private processNextChunk(): void {
        // ── Phase 1: Pre-generation ──────────────────────────────────────────
        const frameStart = performance.now();

        while (this.pregenerationQueue.length > 0) {
            const coord = this.pregenerationQueue[0];
            const key = chunkKey(coord.cx, coord.cy, coord.cz);

            if (this.chunkMap.has(key)) {
                this.pregenerationQueue.shift();
                continue;
            }

            // Check cache BEFORE construction so we know whether to batch.
            const wasCached = isChunkCached(coord.cx, coord.cy, coord.cz);

            const chunk = new Chunk(
                this.device,
                this.chunkBindGroupLayout,
                coord,
                this.fillFn,
                this.isolevel,
            );
            this.chunkMap.set(key, chunk);
            this.pregenerationQueue.shift();

            // Cache miss → marching cubes ran → always stop for this frame.
            // Cache hit  → fast path → keep going until the 10 ms budget runs out.
            if (!wasCached || performance.now() - frameStart > 10) return;
        }

        // ── Phase 2: Normal progressive loading ──────────────────────────────
        while (this.loadQueue.length > 0) {
            const coord = this.loadQueue.shift()!;
            const key = chunkKey(coord.cx, coord.cy, coord.cz);
            if (this.chunkMap.has(key)) continue;

            // WHY: underground chunks (cy < 0) use their own fill function so they
            // start as solid (no triangles) and reveal colour layers when sculpted.
            const fill = coord.cy < 0 && this.undergroundFillFn
                ? this.undergroundFillFn
                : this.fillFn;

            const chunk = new Chunk(
                this.device,
                this.chunkBindGroupLayout,
                coord,
                fill,
                this.isolevel,
            );
            this.chunkMap.set(key, chunk);
            break; // one per frame
        }
    }

    /**
     * Returns current pre-generation progress for the loading bar.
     * isComplete becomes true once every coord in the initial pregen square
     * has been either created as a GPU chunk or cached to localStorage.
     */
    getPregenerationProgress(): { done: number; total: number; isComplete: boolean } {
        if (!this.pregenerationStarted) {
            // First update has not run yet — report as pending.
            return { done: 0, total: 0, isComplete: false };
        }
        const done = this.pregenerationTotal - this.pregenerationQueue.length;
        return {
            done,
            total: this.pregenerationTotal,
            isComplete: done >= this.pregenerationTotal,
        };
    }

    /**
     * Returns true if the given world-space AABB overlaps any triangle in any
     * loaded chunk. Each chunk is pre-rejected with its own AABB before the
     * expensive per-triangle SAT test.
     */
    collidesWithAABB(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): boolean {
        for (const chunk of this.chunkMap.values()) {
            const { x: ox, y: oy, z: oz } = chunk.worldOffset;
            if (maxX < ox || minX > ox + CHUNK_WORLD_SIZE_XZ ||
                maxY < oy || minY > oy + CHUNK_SIZE ||
                maxZ < oz || minZ > oz + CHUNK_WORLD_SIZE_XZ) continue;

            if (chunk.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ)) return true;
        }
        return false;
    }

    /**
     * Returns the outward unit normal of the first triangle that overlaps the
     * given world-space AABB, or null if no triangle overlaps.
     * Used by the camera controller to detect walkable slopes.
     */
    collidesWithAABBNormal(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): Vertex3 | null {
        for (const chunk of this.chunkMap.values()) {
            const { x: ox, y: oy, z: oz } = chunk.worldOffset;
            if (maxX < ox || minX > ox + CHUNK_WORLD_SIZE_XZ ||
                maxY < oy || minY > oy + CHUNK_SIZE ||
                maxZ < oz || minZ > oz + CHUNK_WORLD_SIZE_XZ) continue;

            const normal = chunk.collidesWithAABBNormal(minX, minY, minZ, maxX, maxY, maxZ);
            if (normal) return normal;
        }
        return null;
    }

    /**
     * Cast a ray through all loaded chunks and return the nearest hit triangle.
     * Chunks are pre-rejected with a ray-AABB slab test.
     */
    raycastTriangle(
        ox: number, oy: number, oz: number,
        dx: number, dy: number, dz: number,
        maxDist: number,
    ): RaycastHit | null {
        let best: RaycastHit | null = null;

        for (const chunk of this.chunkMap.values()) {
            const [cox, coy, coz] = chunk.worldOffset;
            if (!rayHitsAABB(ox, oy, oz, dx, dy, dz,
                cox, coy, coz,
                cox + CHUNK_WORLD_SIZE_XZ, coy + CHUNK_SIZE, coz + CHUNK_WORLD_SIZE_XZ,
                best ? best.t : maxDist)) continue;

            const hit = chunk.raycastTriangle(ox, oy, oz, dx, dy, dz,
                best ? best.t : maxDist);
            if (hit) best = hit;
        }
        return best;
    }

    /**
     * Modify the scalar field of every loaded chunk whose AABB overlaps the
     * sculpt sphere, then rebuild those chunks' meshes.
     */
    sculptAt(wx: number, wy: number, wz: number, radius: number, delta: number): void {
        for (const chunk of this.chunkMap.values()) {
            const { x: ox, y: oy, z: oz } = chunk.worldOffset;
            if (wx + radius < ox || wx - radius > ox + CHUNK_WORLD_SIZE_XZ ||
                wy + radius < oy || wy - radius > oy + CHUNK_SIZE ||
                wz + radius < oz || wz - radius > oz + CHUNK_WORLD_SIZE_XZ) continue;

            chunk.sculptAt(wx, wy, wz, radius, delta);
        }
    }

    /**
     * Returns only the chunks within CHUNK_RENDER_DISTANCE of the current camera
     * chunk for draw-call submission. The full chunkMap may contain pre-generated
     * chunks farther away (all in localStorage + GPU memory), but submitting draw
     * calls for distant chunks wastes GPU vertex throughput unnecessarily.
     * Collision, raycasting, and sculpting still iterate the full chunkMap with
     * cheap AABB pre-rejection, so correctness is unaffected.
     */
    getChunks(): Chunk[] {
        const R = CHUNK_RENDER_DISTANCE;
        return Array.from(this.chunkMap.values()).filter(chunk => {
            const cx = chunk.worldOffset.x / CHUNK_WORLD_SIZE_XZ;
            const cz = chunk.worldOffset.z / CHUNK_WORLD_SIZE_XZ;
            return Math.abs(cx - this.currentCamCX) <= R
                && Math.abs(cz - this.currentCamCZ) <= R;
        });
    }

    destroy(): void {
        for (const chunk of this.chunkMap.values()) chunk.destroy();
        this.chunkMap.clear();
    }
}
