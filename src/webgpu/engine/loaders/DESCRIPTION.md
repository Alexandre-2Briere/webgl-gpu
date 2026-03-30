# Loaders

## Role

Parsers for 3D asset file formats. Convert raw file bytes into the engine's internal vertex layout and material data, ready for GPU upload. Two formats are supported: OBJ (geometry only) and FBX (geometry + materials + textures).

## Key Concepts

- **parseObj**: Converts OBJ text into a flat `Float32Array` of interleaved 48-byte vertices and a `Uint32Array` of indices. Two-pass: first pass collects positions and normals, second pass builds deduplicated indexed geometry.
- **parseFbx**: Converts binary or ASCII FBX data into an array of meshes, each with 64-byte interleaved vertices (position, normal, UV, tangent+handedness) and a material (diffuse texture, normal map, base color).
- **Vertex deduplication**: Both parsers deduplicate vertices. OBJ keys by `"posIdx/normIdx"`. FBX keys by `"posIdx|normIdx|uvIdx"`. Deduplication enables indexed drawing.
- **Fan triangulation**: Both parsers triangulate n-gons by fanning from vertex 0. For quads: `(0,1,2), (0,2,3)`. This is correct for convex polygons but wrong for concave ones.

## Invariants

- OBJ indices are 1-based in the file; the parser subtracts 1. All output indices are 0-based.
- OBJ vertex color is always `[1, 1, 1, 1]` regardless of file content.
- OBJ normals: if the file contains `vn` entries, they are used; otherwise flat per-face normals are computed via cross product. If the computed normal has zero length (degenerate face), it falls back to `[0, 1, 0]`.
- FBX UV v-coordinate is flipped (`1 - v`) for WebGPU's top-left UV origin convention.
- FBX tangents are computed via Lengyel's method. Gram-Schmidt orthogonalization ensures `tangent ⊥ normal`. Handedness (`w = ±1`) encodes whether the tangent-bitangent frame is right-handed.
- FBX binary format detected by the magic string `"Kaydara FBX Binary  "` at offset 0. Anything else is treated as ASCII.

## Edge Cases

- **OBJ with no normals**: Flat normals are computed per-face. Adjacent faces sharing a vertex will each compute their own normal independently. The deduplication key is `posIdx/normIdx` — since normal indices don't exist, multiple vertices at the same position may be created (one per face that shares that position).
- **OBJ degenerate face** (zero-length cross product): Falls back to `[0, 1, 0]`. Geometry is still emitted but the face appears lit incorrectly.
- **OBJ n-gons (more than 4 vertices)**: Fan-triangulated from vertex 0. Concave n-gons will have interior triangles that cross the polygon boundary. The OBJ format discourages non-planar faces, but doesn't forbid them.
- **OBJ with only position (`f v`)**: Normals default to `[0, 1, 0]`. Lighting will look flat and wrong.
- **FBX with missing texture**: `diffuseImageData` is `null` in the material. The engine uses a fallback material. The object renders but without the intended texture.
- **FBX with embedded textures**: Embedded texture data (base64 in ASCII FBX, byte array in binary FBX) is decoded inline. If decoding fails, the texture is skipped gracefully.
- **FBX material name null bytes**: FBX names sometimes contain null bytes or `::` separators (Maya convention). The parser strips these. A material named `"Rock::Material\0"` becomes `"Rock"`.
- **FBX degenerate UV triangle** (determinant < 1e-10): Tangent computation is skipped for that triangle. The vertex gets a fallback tangent of `[1, 0, 0, ±1]`.
- **Large OBJ files**: The parser builds a `Map` in memory for vertex deduplication. Very large files with millions of unique vertices will consume significant heap memory during parsing.
- **FBX ByControlPoint vs ByPolygonVertex normals/UVs**: The parser handles both mapping modes. `ByControlPoint` indexes by position index; `ByPolygonVertex` indexes by polygon vertex order. Mixing modes in one FBX file is unusual but supported.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| OBJ with no normals | Silent — flat normals, incorrect lighting |
| OBJ concave n-gon | Silent — incorrect triangulation |
| FBX missing texture | Silent — fallback material |
| FBX degenerate UV triangle | Silent — fallback tangent |
| Very large OBJ file | Memory pressure — possible OOM |
| Corrupted FBX binary header | May parse as ASCII FBX — likely fails |
| OBJ indices out of range | Crash — array access on undefined position |

## Test Scenarios

- **Triangle OBJ**: parse a minimal 3-vertex, 1-face OBJ — verify 3 vertices and 3 indices, correct positions and normals.
- **Quad OBJ**: parse a 4-vertex quad face — verify it becomes 2 triangles (6 indices), fan-triangulated.
- **OBJ no normals**: omit `vn` lines — verify flat normals are computed and equal the face normal.
- **OBJ zero-length normal**: create a degenerate face (collinear vertices) — verify normal falls back to `[0, 1, 0]`.
- **OBJ position-only face** (`f v`): verify normals default to `[0, 1, 0]`.
- **OBJ vertex deduplication**: two faces sharing an edge — verify shared vertices appear once in the output, correct indices reference them.
- **OBJ 1-based indices**: verify positions are correctly mapped from 1-based OBJ indices to 0-based output.
- **FBX binary detection**: test with magic bytes present vs absent — verify correct parser is selected.
- **FBX UV v-flip**: parse a mesh with UV `(0.3, 0.7)` — verify output UV is `(0.3, 0.3)`.
- **FBX missing texture**: parse FBX with no texture path — verify `diffuseImageData = null` and no throw.
- **FBX tangent handedness**: verify `w` is `±1` (not 0 or another value) for all vertices.
- **FBX null-byte material name**: supply a name with `\x00` suffix — verify it is stripped from the output.
