import { CHUNK_SIZE, UNIT_SIZE, CHUNK_SIZE_XZ, XZ_UNIT_SIZE, CHUNK_WORLD_SIZE_XZ } from "../../../common/constants/constants";
import { march } from "../compute";
import { MarchingCubesMesh } from "../mesh";
import { MarchingCubesResult } from "../types/MarchingCubesResult";
import { ScalarField } from "../utils/scalarField";
import { FillFunction } from "../types/FillFunction";
import { ChunkCoord } from "../types/ChunkCoord";
import { RaycastHit, TriangleSpatialHash } from "../utils/collider";
import { Vertex3 } from "../../../common/types/Vertex";
const CACHE_VERSION = 'v3';
// WHY CHUNK_DIMS_STAMP: if CHUNK_SIZE, CHUNK_SIZE_XZ, or XZ_UNIT_SIZE change,
// the stored scalar-field dimensions no longer match the code expectations and
// the display breaks. Embedding the values in the key causes automatic cache
// invalidation whenever any of these constants are edited.
const CHUNK_DIMS_STAMP = `${CHUNK_SIZE}_${CHUNK_SIZE_XZ}_${XZ_UNIT_SIZE}`;

// WHY B64_STEP: process in 32 KB slices so String.fromCharCode.apply() never
// exceeds the JS engine's maximum argument count (varies by runtime, ~65 K args).
const B64_STEP = 0x8000;

// WHY QUANTIZE_RANGE: the fBm Perlin fill function outputs values in roughly
// [-1, 1] (normalised by maxValue = 1.875).  A sculpt delta of ±0.4 can push
// individual corners to ≈ ±1.4.  A range of 2.5 provides a comfortable safety
// margin so no realistic field value is clamped during encode/decode.
const QUANTIZE_RANGE = 2.5;

// ── Binary helpers ────────────────────────────────────────────────────────────

function uint8ToBase64(arr: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < arr.length; i += B64_STEP) {
        // eslint-disable-next-line prefer-spread
        binary += String.fromCharCode.apply(null, arr.subarray(i, i + B64_STEP) as unknown as number[]);
    }
    return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ── RLE compression ───────────────────────────────────────────────────────────
// WHY RLE: terrain scalar fields have large homogeneous regions — deep-solid
// voxels all quantise to 255, open-air voxels to 0. RLE exploits these runs
// to shrink the 268 KB quantised field to roughly 30–130 KB in practice,
// reducing base64 overhead proportionally.

function rleEncode(data: Uint8Array): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < data.length) {
        const val = data[i];
        let count = 1;
        while (i + count < data.length && data[i + count] === val && count < 255) count++;
        out.push(val, count);
        i += count;
    }
    return new Uint8Array(out);
}

function rleDecode(data: Uint8Array, length: number): Uint8Array {
    const out = new Uint8Array(length);
    let pos = 0;
    for (let i = 0; i + 1 < data.length; i += 2) {
        const val = data[i];
        const count = data[i + 1];
        for (let j = 0; j < count; j++) out[pos++] = val;
    }
    return out;
}

// ── Scalar-field ↔ localStorage serialisation ─────────────────────────────────
// WHY store the scalar field instead of the vertex array:
//   • Vertices: up to 1–5 MB per chunk as a raw Float32Array — only 2–5 chunks
//     fit in the typical 5–10 MB localStorage quota before QUOTA_EXCEEDED fires.
//   • Scalar field: (CHUNK_SIZE+1)³ = 274 625 samples, quantised to 1 byte each
//     (≈268 KB), then RLE-compressed to ~30–130 KB in practice.  march() takes
//     only ~1 ms on a cache hit so re-running it at load time is negligible.

function fieldToCache(field: ScalarField): string {
    const quantized = new Uint8Array(field.data.length);
    for (let i = 0; i < field.data.length; i++) {
        const norm = (field.data[i] + QUANTIZE_RANGE) / (2 * QUANTIZE_RANGE);
        quantized[i] = Math.max(0, Math.min(255, Math.round(norm * 255)));
    }
    return uint8ToBase64(rleEncode(quantized));
}

function fieldFromCache(stored: string, xzSize: number, ySize: number): ScalarField {
    const totalSamples = xzSize * ySize * xzSize;
    const quantized = rleDecode(base64ToUint8(stored), totalSamples);
    const field = new ScalarField(xzSize, ySize);
    for (let i = 0; i < totalSamples; i++) {
        field.data[i] = (quantized[i] / 255) * (2 * QUANTIZE_RANGE) - QUANTIZE_RANGE;
    }
    return field;
}

export class Chunk {
    readonly worldOffset: Vertex3;

    private mesh: MarchingCubesMesh;
    private result: MarchingCubesResult;
    // WHY the spatial hash is built once from the CPU-side vertex data that
    // march() already produces. It partitions triangles into a uniform grid so
    // collision queries only test a small local subset rather than the full mesh.
    private collider: TriangleSpatialHash;

    // WHY each chunk owns its own uniform buffer + bind group with the chunk
    // offset baked in at init time. This avoids async writeBuffer race
    // conditions — the GPU always reads the correct pre-baked offset for each
    // chunk, no per-frame writes needed.
    private readonly chunkUniformBuffer: GPUBuffer;
    private readonly chunkBindGroup: GPUBindGroup;

    // WHY field may be null: chunks loaded from localStorage skip fill() and
    // run march() directly on the decoded field, then discard the field to
    // avoid keeping ~1 MB of Float32 data alive per chunk. The field is
    // re-decoded from localStorage on the first sculptAt() call so sculpt
    // edits (including those from previous sessions) are always applied to the
    // correct base data rather than a freshly generated field.
    private field: ScalarField | null;
    private readonly fillFn: FillFunction;
    private readonly isolevel: number;
    private readonly cx: number;
    private readonly cy: number;
    private readonly cz: number;
    private readonly cacheKey: string;

    constructor(
        device: GPUDevice,
        chunkBindGroupLayout: GPUBindGroupLayout,
        coord: ChunkCoord,
        fillFn: FillFunction,
        isolevel: number,
    ) {
        const { cx, cy, cz } = coord;

        this.fillFn = fillFn;
        this.isolevel = isolevel;
        this.cx = cx;
        this.cy = cy;
        this.cz = cz;

        this.worldOffset = new Vertex3(
            cx * CHUNK_WORLD_SIZE_XZ,
            cy * CHUNK_SIZE * UNIT_SIZE,
            cz * CHUNK_WORLD_SIZE_XZ,
        );

        this.cacheKey = `mc_${CACHE_VERSION}_${CHUNK_DIMS_STAMP}_${cx}_${cy}_${cz}`;

        // ── localStorage cache lookup ──────────────────────────────────────────
        // Cache hit: decode the stored scalar field and run march() (~1 ms).
        //   The field is then discarded (this.field = null) to save memory;
        //   it will be re-decoded from localStorage on the first sculpt.
        // Cache miss: fill ScalarField from the noise function (~20 ms), run
        //   march(), then persist the compressed field to localStorage.
        let result: MarchingCubesResult | undefined;
        let field: ScalarField | null = null;

        try {
            const stored = localStorage.getItem(this.cacheKey);
            if (stored !== null) {
                const cachedField = fieldFromCache(stored, CHUNK_SIZE_XZ + 1, CHUNK_SIZE + 1);
                result = march(cachedField, isolevel);
                // field stays null — re-decoded from localStorage on first sculpt
            }
        } catch { /* storage unavailable or entry corrupt — fall through */ }

        if (result === undefined) {
            const freshField = new ScalarField(CHUNK_SIZE_XZ + 1, CHUNK_SIZE + 1);
            freshField.fill((lx, ly, lz) =>
                fillFn(
                    cx * CHUNK_WORLD_SIZE_XZ + lx * XZ_UNIT_SIZE,
                    cy * CHUNK_SIZE + ly,
                    cz * CHUNK_WORLD_SIZE_XZ + lz * XZ_UNIT_SIZE,
                )
            );
            result = march(freshField, isolevel);
            field = freshField;
            try {
                localStorage.setItem(this.cacheKey, fieldToCache(freshField));
            } catch { /* quota exceeded — operate without cache */ }
        }
        // ──────────────────────────────────────────────────────────────────────

        this.result = result;
        this.field = field;

        this.mesh = new MarchingCubesMesh(device, this.result);
        this.collider = new TriangleSpatialHash(this.result, this.worldOffset);

        // WHY 16 bytes = vec3f (12) + 4 bytes padding required by WGSL uniform
        // alignment rules. The offset is baked in here once and never written
        // again — no per-frame sync needed.
        this.chunkUniformBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.chunkUniformBuffer.getMappedRange()).set([
            this.worldOffset.x, this.worldOffset.y, this.worldOffset.z, 0,
        ]);
        this.chunkUniformBuffer.unmap();

        this.chunkBindGroup = device.createBindGroup({
            layout: chunkBindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: this.chunkUniformBuffer } }],
        });
    }

    /**
     * Returns true if the given world-space AABB overlaps any triangle in this
     * chunk's mesh. Used by the camera controller for solid-geometry collision.
     */
    collidesWithAABB(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): boolean {
        return this.collider.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /**
     * Returns the outward unit normal of the first overlapping triangle, or null.
     * Used by the camera controller to detect walkable slopes.
     */
    collidesWithAABBNormal(
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
    ): Vertex3 | null {
        return this.collider.collidesWithAABBNormal(minX, minY, minZ, maxX, maxY, maxZ);
    }

    /** Cast a ray and return the nearest hit triangle in this chunk, or null. */
    raycastTriangle(
        ox: number, oy: number, oz: number,
        dx: number, dy: number, dz: number,
        maxDist: number,
    ): RaycastHit | null {
        return this.collider.raycastTriangle(ox, oy, oz, dx, dy, dz, maxDist);
    }

    /**
     * Draw this chunk in the given render pass.
     * The caller (world.ts) is responsible for setting the pipeline and group 0
     * (frame uniforms) before calling this.
     */
    draw(renderPass: GPURenderPassEncoder): void {
        // WHY group 1 is this chunk's own bind group with its offset baked in.
        // The renderer already set group 0 (frame uniforms) before the loop.
        renderPass.setBindGroup(1, this.chunkBindGroup);
        renderPass.setVertexBuffer(0, this.mesh.getBuffer());
        renderPass.draw(this.mesh.getVertexCount());
    }

    /**
     * Re-run marching cubes with a new fill function (e.g. for dynamic terrain).
     * Uploads updated vertex data via mesh.update().
     */
    rebuild(fillFn: FillFunction, isolevel: number): void {
        const field = new ScalarField(CHUNK_SIZE_XZ + 1, CHUNK_SIZE + 1);
        field.fill(fillFn);
        this.result = march(field, isolevel);
        this.mesh.update(this.result);
        this.collider = new TriangleSpatialHash(this.result, this.worldOffset);
    }

    /**
     * Modify the scalar field within a sphere of the given world-space radius
     * centred on (wx, wy, wz), then rebuild the mesh.
     *
     * Positive delta adds material (fills), negative delta removes it.
     * The influence falls off linearly from |delta| at the centre to 0 at
     * the edge of the sphere so edits feel smooth rather than blocky.
     *
     * WHY re-decode field from localStorage on lazy init: if the chunk was
     * loaded from cache (this.field === null), decoding the stored field
     * preserves any sculpt edits made in previous sessions. Falling back to
     * the fill function would silently discard that history.
     */
    sculptAt(wx: number, wy: number, wz: number, radius: number, delta: number): void {
        if (!this.field) {
            // Try localStorage first so sculpt edits from prior sessions survive.
            try {
                const stored = localStorage.getItem(this.cacheKey);
                if (stored !== null) {
                    this.field = fieldFromCache(stored, CHUNK_SIZE_XZ + 1, CHUNK_SIZE + 1);
                }
            } catch { /* ignore */ }

            // Fall back to fill function if cache is unavailable or missing.
            if (!this.field) {
                this.field = new ScalarField(CHUNK_SIZE_XZ + 1, CHUNK_SIZE + 1);
                this.field.fill((lx, ly, lz) =>
                    this.fillFn(
                        this.cx * CHUNK_WORLD_SIZE_XZ + lx * XZ_UNIT_SIZE,
                        this.cy * CHUNK_SIZE + ly,
                        this.cz * CHUNK_WORLD_SIZE_XZ + lz * XZ_UNIT_SIZE,
                    )
                );
            }
        }

        const { x: offX, y: offY, z: offZ } = this.worldOffset;

        // WHY per-axis step: XZ and Y use different grid spacings, so the
        // world-to-grid conversion differs per axis. Grid indices are
        // fractional; distance comparisons are done in world space so the
        // brush sphere is geometrically correct despite the anisotropic grid.
        const localX = (wx - offX) / XZ_UNIT_SIZE;
        const localY = (wy - offY) / UNIT_SIZE;
        const localZ = (wz - offZ) / XZ_UNIT_SIZE;
        const rXZ = radius / XZ_UNIT_SIZE;
        const rY = radius / UNIT_SIZE;
        const r2 = radius * radius;

        const x0 = Math.max(0, Math.floor(localX - rXZ));
        const x1 = Math.min(this.field.width - 1, Math.ceil(localX + rXZ));
        const y0 = Math.max(0, Math.floor(localY - rY));
        const y1 = Math.min(this.field.height - 1, Math.ceil(localY + rY));
        const z0 = Math.max(0, Math.floor(localZ - rXZ));
        const z1 = Math.min(this.field.depth - 1, Math.ceil(localZ + rXZ));

        let modified = false;
        for (let fz = z0; fz <= z1; fz++) {
            for (let fy = y0; fy <= y1; fy++) {
                for (let fx = x0; fx <= x1; fx++) {
                    // World-space distance so the sphere is round, not stretched.
                    const ex = (fx - localX) * XZ_UNIT_SIZE;
                    const ey = (fy - localY) * UNIT_SIZE;
                    const ez = (fz - localZ) * XZ_UNIT_SIZE;
                    const dist2 = ex * ex + ey * ey + ez * ez;
                    if (dist2 > r2) continue;
                    // WHY linear falloff: a flat-top brush creates sharp rings
                    // at the brush boundary. Linear falloff blends naturally
                    // with neighbouring unmodified corners.
                    const falloff = 1.0 - Math.sqrt(dist2) / radius;
                    this.field.data[this.field.index(fx, fy, fz)] += delta * falloff;
                    modified = true;
                }
            }
        }

        if (!modified) return;

        this.result = march(this.field, this.isolevel);
        this.mesh.update(this.result);
        this.collider = new TriangleSpatialHash(this.result, this.worldOffset);

        // WHY save updated field: persisting the modified field means sculpt
        // edits survive page reloads. The next visit decodes the field, runs
        // march(), and restores the sculpted mesh exactly.
        try {
            localStorage.setItem(this.cacheKey, fieldToCache(this.field));
        } catch { /* quota exceeded — edits are visible this session but not persisted */ }
    }

    destroy(): void {
        this.mesh.destroy();
        this.chunkUniformBuffer.destroy();
    }
}

/**
 * Returns true if the chunk at (cx, cy, cz) already has a cached entry in
 * localStorage. Used by the pre-generation queue to decide whether a cache-hit
 * frame budget (10 ms) or a single-chunk stop applies.
 */
export function isChunkCached(cx: number, cy: number, cz: number): boolean {
    try {
        return localStorage.getItem(`mc_${CACHE_VERSION}_${CHUNK_DIMS_STAMP}_${cx}_${cy}_${cz}`) !== null;
    } catch {
        return false;
    }
}

/**
 * Remove all localStorage entries written by previous cache formats. Call this
 * once at startup to reclaim space so the current format has room in the quota.
 *   v1: raw Float32 vertex arrays encoded as base64
 *   v2: RLE+base64 scalar field, cubic (CHUNK_SIZE+1)³ — now replaced by the
 *       anisotropic (CHUNK_SIZE_XZ+1)×(CHUNK_SIZE+1)×(CHUNK_SIZE_XZ+1) v3 layout
 */
export function clearLegacyCaches(): void {
    const legacyPrefixes = ['mc_v1_', 'mc_v2_'];
    const toRemove: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && legacyPrefixes.some(p => key.startsWith(p))) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) localStorage.removeItem(key);
    } catch { /* storage unavailable — nothing to clean up */ }
}
