// src/modules/marchingCubes/utils/fillPlane.ts
//
// WHY a separate Perlin table: fillPerlin.ts owns its own module-level table for
// the volumetric terrain noise. Keeping a dedicated table here ensures the flat
// plane surface pattern is independent, and prevents the two fill modes from
// interfering if both are instantiated in the same session.

import { FillFunction } from '../types/FillFunction';
import { PlaneFillOptions } from '../types/PlaneFillOptions';

const PERM_SIZE = 256;
const perm = new Uint8Array(PERM_SIZE * 2);

(function buildPermTable() {
    const table = new Uint8Array(PERM_SIZE);
    for (let i = 0; i < PERM_SIZE; i++) table[i] = i;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [table[i], table[j]] = [table[j], table[i]];
    }
    for (let i = 0; i < PERM_SIZE * 2; i++) perm[i] = table[i & 255];
})();

const GRAD3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
    1, 1, 0, -1, 1, 0, 0, -1, 1, 0, -1, -1,
]);

function grad(hash: number, x: number, y: number, z: number): number {
    const h = (hash & 15) * 3;
    return GRAD3[h] * x + GRAD3[h + 1] * y + GRAD3[h + 2] * z;
}

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

function perlin3(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const a  = perm[xi]     + yi;
    const b  = perm[xi + 1] + yi;
    const aa = perm[a]      + zi;
    const ab = perm[a + 1]  + zi;
    const ba = perm[b]      + zi;
    const bb = perm[b + 1]  + zi;

    return lerp(
        lerp(
            lerp(grad(perm[aa],     xf,     yf,     zf),
                 grad(perm[ba],     xf - 1, yf,     zf), u),
            lerp(grad(perm[ab],     xf,     yf - 1, zf),
                 grad(perm[bb],     xf - 1, yf - 1, zf), u),
            v),
        lerp(
            lerp(grad(perm[aa + 1], xf,     yf,     zf - 1),
                 grad(perm[ba + 1], xf - 1, yf,     zf - 1), u),
            lerp(grad(perm[ab + 1], xf,     yf - 1, zf - 1),
                 grad(perm[bb + 1], xf - 1, yf - 1, zf - 1), u),
            v),
        w);
}

// WHY XZ-only fBm: sampling Perlin with Y fixed at 0 produces a 2-D surface
// height map rather than a volumetric density field. This gives a smooth,
// mostly-flat terrain without caves or overhangs — just gentle bumps.
//
// WHY clamp to [-1, 1]: the QUANTIZE_RANGE constant in chunk.ts is 2.5,
// sized for the Perlin fill's [-1, 1] output plus sculpt headroom. Keeping
// this fill in the same range makes the two modes interchangeable without
// touching the cache serialisation.
//
// Chunk connectivity: the fill function depends only on world-space coordinates
// (wx, wz). Adjacent chunks share the same sample at their common boundary
// (Chunk A samples wx = cx*SIZE + SIZE; Chunk B samples wx = (cx+1)*SIZE + 0 =
// cx*SIZE + SIZE) so seams are automatically consistent — no special edge logic
// is needed.
export function createPlaneFill(options: PlaneFillOptions = {}): FillFunction {
    const {
        surfaceY       = 0,
        noiseScale     = 0.03,
        noiseAmplitude = 2.0,
        octaves        = 3,
        persistence    = 0.5,
        lacunarity     = 2.0,
    } = options;

    return (wx: number, wy: number, wz: number): number => {
        // Accumulate fBm noise over XZ only (Y fixed at 0).
        let noise    = 0;
        let amplitude = 1;
        let frequency = noiseScale;
        let maxValue  = 0;

        for (let o = 0; o < octaves; o++) {
            noise    += perlin3(wx * frequency, 0, wz * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        // Normalise to [-1, 1] then scale to the desired height range.
        const surfaceOffset = (noise / maxValue) * noiseAmplitude;

        // Density: positive = underground, negative = above ground.
        // Clamped to [-1, 1] so deep-solid / high-air voxels saturate cleanly.
        const density = surfaceY - wy + surfaceOffset;
        return Math.max(-1, Math.min(1, density));
    };
}
