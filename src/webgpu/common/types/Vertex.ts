export class Vertex3 {
    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
    ) {}

    *[Symbol.iterator](): Iterator<number> {
        yield this.x;
        yield this.y;
        yield this.z;
    }
}

export type Vertex2 = {
    x: number;
    y: number;
};
