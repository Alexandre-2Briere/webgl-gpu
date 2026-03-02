// src/modules/marchingCubes/scalarField.ts

import { UNIT_SIZE } from '../../../common/constants/constants';

export class ScalarField {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly data: Float32Array;

    constructor(size: number) {
        this.width = size;
        this.height = size;
        this.depth = size;
        this.data = new Float32Array(this.width * this.height * this.depth);
    }

    worldPosition(x: number, y: number, z: number): [number, number, number] {
        return [x * UNIT_SIZE, y * UNIT_SIZE, z * UNIT_SIZE];
    }

    index(x: number, y: number, z: number): number {
        return x + y * this.width + z * this.width * this.height;
    }

    get(x: number, y: number, z: number): number {
        return this.data[this.index(x, y, z)];
    }

    set(x: number, y: number, z: number, value: number): void {
        this.data[this.index(x, y, z)] = value;
    }

    fill(fn: (x: number, y: number, z: number) => number): void {
        for (let z = 0; z < this.depth; z++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    this.set(x, y, z, fn(x, y, z));
                }
            }
        }
    }
}