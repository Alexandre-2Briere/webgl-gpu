// src/common/constants/constants.ts

import { isPowerOf2 } from '../utils/math/math';

export const CHUNK_SIZE = 32;
export const WORLD_SIZE = 4;
// How many chunks to load in each direction (±) from the camera chunk.
// Total loaded area = (2 * CHUNK_RENDER_DISTANCE + 1)² chunks.
export const CHUNK_RENDER_DISTANCE = 2;
// Pre-generation radius on first load. All chunks within this distance are
// computed and cached to localStorage so future visits load near-instantly.
export const CHUNK_PREGENERATION_DISTANCE = CHUNK_RENDER_DISTANCE * 2;
export const UNIT_SIZE = 1.0;

// XZ resolution: 2× more sample points than CHUNK_SIZE but 4× smaller spacing,
// so each chunk covers 32 world units in XZ (vs 64 for Y).
// This gives 4× denser triangle geometry in XZ with the same terrain shape.
export const CHUNK_SIZE_XZ = CHUNK_SIZE * 2;             // 128 voxel cells in X and Z
export const XZ_UNIT_SIZE = UNIT_SIZE / 2;              // 0.25 world units per XZ step
export const CHUNK_WORLD_SIZE_XZ = CHUNK_SIZE_XZ * XZ_UNIT_SIZE; // 32 world units per chunk in XZ

// Camera prism (rectangular) hitbox dimensions in world units.
// Adjust these constants to tune collision feel without touching gameplay code.
export const CAMERA_HITBOX_WIDTH = 1.0;  // X footprint (metres)
export const CAMERA_HITBOX_DEPTH = 1.0;  // Z footprint (metres)
export const CAMERA_HITBOX_HEIGHT = 12.0;  // total height  (metres)

// Physics — tune these to adjust movement feel.
export const GRAVITY = 20.0;              // downward acceleration (units/s²)
export const JUMP_FORCE = 10.0;           // initial upward velocity on jump (units/s)
export const TERMINAL_VELOCITY = 50.0;    // maximum fall speed (units/s)
// Surface inclination (°) below which the player slides up the slope instead of being blocked.
// 0° = flat floor, 90° = vertical wall. Default 45° lets ramps up to 45° be climbed.
export const MAX_WALKABLE_SLOPE_DEG = 90;
// Downward probe distance used each frame to decide if the player is on the ground.
export const GROUND_CHECK_EPSILON = 0.15;

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