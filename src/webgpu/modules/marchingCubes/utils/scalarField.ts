// src/modules/marchingCubes/scalarField.ts

import { UNIT_SIZE, XZ_UNIT_SIZE } from '../../../common/constants/constants';

export class ScalarField {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    // WHY separate step sizes: XZ uses a finer grid than Y so the same terrain
    // noise is sampled 4× more densely in XZ without changing the Y resolution.
    readonly xzStep: number;
    readonly yStep: number;
    readonly data: Float32Array;

    constructor(xzSize: number, ySize: number) {
        this.width  = xzSize;
        this.height = ySize;
        this.depth  = xzSize;
        this.xzStep = XZ_UNIT_SIZE;
        this.yStep  = UNIT_SIZE;
        this.data = new Float32Array(this.width * this.height * this.depth);
    }

    worldPosition(x: number, y: number, z: number): [number, number, number] {
        return [x * this.xzStep, y * this.yStep, z * this.xzStep];
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
