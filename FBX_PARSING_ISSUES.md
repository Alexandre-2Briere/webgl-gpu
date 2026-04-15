# FBX Parsing Issues — Root Cause Analysis

## Context

Debug logs captured while loading an FBX file with 1 geometry and 2 materials, no embedded textures.

```
Objects found — geometries: 1, materials: 2, textures: 0
Connections — OO pairs: 4, OP pairs: 0
Material id=157863703 name="Material"
Material id=90821626 name="Material"
Geometry id=838437936 name="Geometry" → modelId=570277243
Model 570277243 siblings: [838437936, 157863703, 90821626]
Sibling 838437936 isMaterial=false
Sibling 157863703 isMaterial=true
→ Assigned material id=157863703 name="Material" to geometry "Geometry"
extractMaterial "Material" (id=157863703) — OP connections targeting this material: 0
Material "Material" resolved — diffuseTex=null, normalTex=null, baseColor=[1, 1, 1]
Material "Material" decoded — diffuseImageData=null, normalMapImageData=null
```

---

## Issue 1 — Multi-material meshes: only the first material is applied

### What happens

`parseFbx.ts` finds one geometry connected to model `570277243`. That model has three siblings:
`838437936` (the geometry itself), `157863703` (Material A), `90821626` (Material B).

The code iterates the sibling list and **breaks as soon as it finds the first material**:

```typescript
// src/webgpu/engine/loaders/parseFbx.ts : ~151
for (const sibId of siblings) {
  if (materialById.has(sibId)) {
    material = await extractMaterial(...);
    break;   // <— stops here, Material B is never seen
  }
}
```

Material B (`90821626`) is silently discarded. The entire geometry receives only Material A.

### Why this is wrong

In FBX, a single `Geometry` node can use **multiple materials simultaneously**. Each polygon in the mesh is mapped to a material index via a `LayerElementMaterial` node inside the geometry:

```
Geometry {
  LayerElementMaterial {
    MappingInformationType: "ByPolygon"
    ReferenceInformationType: "IndexToDirect"
    Materials: [0, 0, 1, 1, 0, 1, ...]  ← per-polygon index into the material list
  }
}
```

The material list order matches the order in which materials appear as siblings of the model node.  
So polygon 0 and 1 use material at index 0 (`157863703`), polygon 2 and 3 use material at index 1 (`90821626`), etc.

The current code:
1. Does not read `LayerElementMaterial` at all.
2. Does not build a per-polygon material index list.
3. Does not split the geometry into sub-meshes, one per material.

### Consequence

Every polygon in the mesh gets the color/texture of the first material found. For an oak tree with bark (brown) and leaf (green) materials, everything renders as bark-colored.

### What a fix would need to do

1. **Read `LayerElementMaterial`** from the geometry node and build a `number[]` array that maps each polygon to a material index (0-based).
2. **Collect all material siblings** of the model in order (not just the first one).
3. **Split the geometry** during triangulation: group triangles by their material index and emit one `ParsedFbxMesh` per material group.

---

## Issue 2 — Image textures are never loaded

### What happens

The debug log shows `textures: 0` and `OP pairs: 0`. This means:

- The FBX `Objects` section contains **no `Texture` nodes**.
- There are **no `OP`-type connections** linking any texture to any material.

Because `textureById` is empty and `opConnections` is empty, `extractMaterial` finds nothing:

```
extractMaterial "Material" (id=157863703) — OP connections targeting this material: 0
Material "Material" resolved — diffuseTex=null, normalTex=null
```

### Why textures are missing from the FBX node graph

There are two separate reasons, depending on the FBX file:

#### 2a — Textures stored externally, referenced inline in material properties

Some exporters (Blender's FBX exporter in "path only" mode, some game tools) write texture paths **directly inside `Properties70` of the material node** rather than creating a separate `Texture` object. The structure looks like:

```
Material {
  Properties70 {
    P: "DiffuseColor", "ColorRGB", ...
    P: "DiffuseMap", "KString", "XRefUrl", "", "textures/bark_diffuse.png"
    P: "NormalMap",  "KString", "XRefUrl", "", "textures/bark_normal.png"
  }
}
```

The current `extractMaterial` only reads `DiffuseColor` / `Diffuse` from `Properties70`; it never scans for `KString` properties that carry file paths.

#### 2b — Textures are external files and `decodeTexture` cannot load them

Even when a `Texture` node exists with a `RelativeFilename` or `FileName` child, `decodeTexture` only handles the **embedded `Content` node**:

```typescript
// src/webgpu/engine/loaders/parseFbx.ts : ~473
async function decodeTexture(texNode: FBXReaderNode): Promise<ImageBitmap | null> {
  const contentNode = texNode.node('Content');
  if (contentNode) { /* decode bytes → ImageBitmap */ }
  return null;  // <— external textures always return null here
}
```

The code does capture `diffuseTexturePath` and `normalMapTexturePath` and returns them in `ParsedFbxMaterial`, but nothing ever uses those paths to fetch the actual image. The consumer (`FbxAsset.ts`) would need to:
1. Receive the path string.
2. Resolve it relative to the FBX file's base URL.
3. `fetch()` the image and call `createImageBitmap()`.

That second step does not exist anywhere in the current pipeline.

### Consequence

All FBX materials resolve to `diffuseImageData: null` and `normalMapImageData: null`. The engine falls back to its 1×1 white texture and flat normal map, so the model renders completely white with no surface detail.

### What a fix would need to do

**For externally-referenced textures (`Texture` nodes present but no `Content`):**
1. In `decodeTexture` (or its caller), detect that `Content` is absent.
2. Return the path string instead of `null`.
3. In the `FbxAsset` layer, `fetch(resolvedUrl)` → `blob()` → `createImageBitmap()`.

**For inline `Properties70` texture paths (no `Texture` node at all):**
1. In `extractMaterial`, scan `Properties70` for `P` entries whose type is `"KString"` and whose name ends with `Map`, `Texture`, or matches known FBX property names (`DiffuseMap`, `NormalMap`, `BumpMap`, etc.).
2. Extract the path string from prop index 4.
3. Follow the same external-fetch path described above.

---

## Summary table

| Issue | Root location | What is missing |
|---|---|---|
| Multi-material color | `extractScene` loop (`break` after first material) | Read `LayerElementMaterial`, collect all material siblings, split geometry by material index |
| Textures — external file | `decodeTexture` (no `Content` fallback) | Fetch external URL from `diffuseTexturePath` in the consuming layer (`FbxAsset`) |
| Textures — inline path in Properties70 | `extractMaterial` (only reads `DiffuseColor`) | Scan `KString` props in `Properties70` for texture paths when no `Texture` node exists |
