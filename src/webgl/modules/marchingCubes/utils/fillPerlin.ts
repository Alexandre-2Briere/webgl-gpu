// src/modules/marchingCubes/utils/perlinFill.ts

import { FillFunction } from '../types/FillFunction';
import { PerlinFillOptions } from '../types/PerlinFillOptions';

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

    const a = perm[xi] + yi;
    const b = perm[xi + 1] + yi;
    const aa = perm[a] + zi;
    const ab = perm[a + 1] + zi;
    const ba = perm[b] + zi;
    const bb = perm[b + 1] + zi;

    return lerp(
        lerp(
            lerp(grad(perm[aa], xf, yf, zf),
                grad(perm[ba], xf - 1, yf, zf), u),
            lerp(grad(perm[ab], xf, yf - 1, zf),
                grad(perm[bb], xf - 1, yf - 1, zf), u),
            v),
        lerp(
            lerp(grad(perm[aa + 1], xf, yf, zf - 1),
                grad(perm[ba + 1], xf - 1, yf, zf - 1), u),
            lerp(grad(perm[ab + 1], xf, yf - 1, zf - 1),
                grad(perm[bb + 1], xf - 1, yf - 1, zf - 1), u),
            v),
        w);
}

// WHY: Default fBm parameters were chosen for a CHUNK_SIZE=128 terrain:
//   scale=0.05  → one noise period spans ~20 voxels, giving visible hills
//                 without micro-noise or a completely flat surface.
//   octaves=4   → four layers balance surface detail against the cost of
//                 4× perlin3 calls per voxel; more octaves yield diminishing
//                 visual returns for this voxel resolution.
//   persistence=0.5 → each octave has half the amplitude of the previous,
//                     the classic fBm ratio that gives natural-looking terrain.
//   lacunarity=2.0  → each octave doubles in frequency; paired with
//                     persistence=0.5 this keeps the spectral slope neutral.
//   threshold=0.0  → the isosurface sits at the midpoint of the noise range,
//                    producing roughly 50% solid / 50% air (sea-level).
export function createPerlinFill(options: PerlinFillOptions = {}): FillFunction {
    const {
        scale = 0.05,
        octaves = 4,
        persistence = 0.5,
        lacunarity = 2.0,
        threshold = 0.0,
    } = options;

    return (wx: number, wy: number, wz: number): number => {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let o = 0; o < octaves; o++) {
            value += perlin3(wx * frequency, wy * frequency, wz * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return (value / maxValue) - threshold;
    };
}