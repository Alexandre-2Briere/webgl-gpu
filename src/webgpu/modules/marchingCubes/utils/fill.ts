import { CHUNK_SIZE } from "../../../common/constants/constants";
import { ISO_LEVEL, RANDOM_FACTOR } from "../constants/general";

export function sphere(x: number, y: number, z: number): number {
    const centerX = CHUNK_SIZE / 2;
    const centerY = CHUNK_SIZE / 2;
    const centerZ = CHUNK_SIZE / 2;
    return Math.sqrt(
        (x - centerX) ** 2 +
        (y - centerY) ** 2 +
        (z - centerZ) ** 2
    );
}

export function random(): number {
    return Math.random() * ISO_LEVEL * RANDOM_FACTOR;
}