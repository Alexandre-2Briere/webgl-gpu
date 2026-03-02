// src/modules/marchingCubes/marchingCubesCompute.ts

import { edgeTable, triangleTable } from './constants/lookupTables';
import { ScalarField } from './utils/scalarField';
import { UNIT_SIZE, CORNER_OFFSETS, EDGE_CORNERS } from '../../common/constants/constants';
import { Vertex3 } from './types/Vertex';
import { MarchingCubesResult } from './types/MarchingCubesResult';
import { interpolate } from '../../common/utils/math/interpolate';

export function march(field: ScalarField, isolevel: number): MarchingCubesResult {
    const { width, height, depth } = field;

    // WHY: Two-pass approach — first count output floats so we can allocate exactly
    // the right Float32Array. Pre-allocating the worst case (voxel count × 45 floats)
    // would exceed 300 MB for a 128³ chunk, making it impractical. The cube-index
    // loop therefore runs twice, but march() is called once at chunk init and never
    // inside the render loop, so the doubled CPU cost is acceptable.

    // --- Pass 1: count output floats ---
    let floatCount = 0;
    for (let z = 0; z < depth - 1; z++) {
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const cornerValues = CORNER_OFFSETS.map(([ox, oy, oz]) =>
                    field.get(x + ox, y + oy, z + oz)
                );
                let cubeIndex = 0;
                cornerValues.forEach((value, i) => {
                    if (value < isolevel) cubeIndex |= (1 << i);
                });
                if (edgeTable[cubeIndex] === 0) continue;
                // triangleTable row length = number of edge indices;
                // each index maps to one vertex with 3 floats (x, y, z).
                floatCount += triangleTable[cubeIndex].length * 3;
            }
        }
    }

    // --- Pass 2: allocate and fill ---
    const vertices = new Float32Array(floatCount);
    let idx = 0;

    for (let z = 0; z < depth - 1; z++) {
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {

                // Sample the 8 corners
                const cornerValues = CORNER_OFFSETS.map(([ox, oy, oz]) =>
                    field.get(x + ox, y + oy, z + oz)
                );

                // Build the 8-bit cube index
                let cubeIndex = 0;
                cornerValues.forEach((value, i) => {
                    if (value < isolevel) cubeIndex |= (1 << i);
                });
                if (edgeTable[cubeIndex] === 0) continue;

                // World space positions of the 8 corners
                const corners: Vertex3[] = CORNER_OFFSETS.map(([ox, oy, oz]) => ({
                    x: (x + ox) * UNIT_SIZE,
                    y: (y + oy) * UNIT_SIZE,
                    z: (z + oz) * UNIT_SIZE,
                }));

                // Interpolate only active edges
                const activeEdges = edgeTable[cubeIndex];
                const edgeVertices: (Vertex3 | null)[] = EDGE_CORNERS.map(([cornerA, cornerB], edgeIndex) => {
                    if (!(activeEdges & (1 << edgeIndex))) return null;
                    return interpolate(
                        isolevel,
                        corners[cornerA],
                        corners[cornerB],
                        cornerValues[cornerA],
                        cornerValues[cornerB]
                    );
                });

                // Emit triangles
                const triangleRow = triangleTable[cubeIndex];
                for (let i = 0; i < triangleRow.length; i += 3) {
                    const vertexA = edgeVertices[triangleRow[i]];
                    const vertexB = edgeVertices[triangleRow[i + 1]];
                    const vertexC = edgeVertices[triangleRow[i + 2]];

                    if (!vertexA || !vertexB || !vertexC) continue;

                    vertices[idx++] = vertexA.x;
                    vertices[idx++] = vertexA.y;
                    vertices[idx++] = vertexA.z;
                    vertices[idx++] = vertexB.x;
                    vertices[idx++] = vertexB.y;
                    vertices[idx++] = vertexB.z;
                    vertices[idx++] = vertexC.x;
                    vertices[idx++] = vertexC.y;
                    vertices[idx++] = vertexC.z;
                }
            }
        }
    }

    return {
        // WHY: subarray(0, idx) returns a zero-copy view of exactly the written
        // region. In the correct MC case idx === floatCount; the guard above
        // exists only as a defensive check so this handles both cases safely.
        vertices: vertices.subarray(0, idx),
        vertexCount: idx / 3,
    };
}
