// src/common/constants/constants.ts

import { isPowerOf2 } from '../utils/math/math';

export const CHUNK_SIZE = 64;
export const WORLD_SIZE = 4;
export const UNIT_SIZE = 1.0;

// Camera prism (rectangular) hitbox dimensions in world units.
// Adjust these constants to tune collision feel without touching gameplay code.
export const CAMERA_HITBOX_WIDTH = 1.0;  // X footprint (metres)
export const CAMERA_HITBOX_DEPTH = 1.0;  // Z footprint (metres)
export const CAMERA_HITBOX_HEIGHT = 8.0;  // total height  (metres)

export const VERTEX_COMPONENTS = 3; // x, y, z
export const FLOAT_BYTE_SIZE = 4;   // Float32 = 4 bytes
export const BUFFER_OFFSET = 0;
export const BUFFER_STRIDE = 0;     // 0 means tightly packed


// Offsets for the 8 corners of a cube [x, y, z]
export const CORNER_OFFSETS: [number, number, number][] = [
    [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
    [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];

// Which 2 corners each of the 12 edges connects [cornerA, cornerB]
export const EDGE_CORNERS: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
];

if (!isPowerOf2(CHUNK_SIZE)) {
    throw new Error(`CHUNK_SIZE must be a power of 2, got ${CHUNK_SIZE}`);
}