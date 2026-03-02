import { Vertex3 } from '../../types/Vertex';

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
    return new Vertex3(
        vertexA.x + t * (vertexB.x - vertexA.x),
        vertexA.y + t * (vertexB.y - vertexA.y),
        vertexA.z + t * (vertexB.z - vertexA.z),
    );
}
