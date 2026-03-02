// WHY: Vertex3 is defined locally rather than imported from modules/marchingCubes
// because common/ code must not depend on modules/. TypeScript structural typing
// ensures this definition is assignment-compatible with any other {x,y,z} type.
type Vertex3 = { x: number; y: number; z: number };

export function interpolate(
    isolevel: number,
    vertexA: Vertex3,
    vertexB: Vertex3,
    valueA: number,
    valueB: number): Vertex3 {
    if (Math.abs(isolevel - valueA) < 0.00001) return vertexA;
    if (Math.abs(isolevel - valueB) < 0.00001) return vertexB;
    if (Math.abs(valueA - valueB) < 0.00001) return vertexA;

    const t = (isolevel - valueA) / (valueB - valueA);
    return {
        x: vertexA.x + t * (vertexB.x - vertexA.x),
        y: vertexA.y + t * (vertexB.y - vertexA.y),
        z: vertexA.z + t * (vertexB.z - vertexA.z),
    };
}
