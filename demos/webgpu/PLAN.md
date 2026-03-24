# Plan: WebGPU Tile-Builder Demo

## Context
Replace the smoke-test in `demos/webgpu/` with a real interactive tile-builder demo using the existing engine API. No engine modifications. The demo is an isometric-style grid world where the user places and removes FBX forest tiles via locked (WASD + look) or unlocked (click-to-select) modes.

---

## Files to Create / Rewrite

| File | Action |
|------|--------|
| `demos/webgpu/index.html` | Rewrite — canvas + overlay CSS |
| `demos/webgpu/main.ts` | Rewrite — minimal bootstrap only |
| `demos/webgpu/tileBuilder.ts` | Create — all demo logic |

No engine files are touched.

---

## Architecture

```
index.html  (canvas + CSS for hotbar/instructions overlay)
  └── main.ts  (Engine.create → camera → initTileBuilder → engine.start)
        └── tileBuilder.ts  (grid, input, hotbar, raycasting, logic RAF)
```

---

## Verified Engine Behaviors (from source)

- `Scene.frame()` calls `camera.updateMatrices()` + `camera.uploadTo()` — never call these ourselves.
- **Quad3D alpha blending** confirmed: `src-alpha / one-minus-src-alpha` in pipeline.
- **Quad3D vertex color × tint** — final color = baked vertex color × `setColor` tint. Create highlight with `color:[1,1,1,1]` so `setColor()` is the sole driver.
- **Quad3D axis convention** (normal=[0,1,0]): `width` = extent along **Z**, `height` = extent along **X**. Tangent=Z, bitangent=X.
- **`setModelMatrix`** replaces the transform; WGSL applies it as `object.model * vertexPos`. Bake highlight at `position:[0,0.01,0]`; move via translation matrix each frame.
- **`FbxModel.destroy()`** is a no-op — shared asset buffers are preserved, uniform slot is NOT freed, model is NOT removed from scene. Tile removal = `handle.visible = false` only.
- **`Scene.remove()`** exists but is not reachable through the public Engine API. Invisible objects remain in the world renderables list but are skipped in `encode`. Pool slot leak is bounded by grid size (max 144 tiles ≪ 512 pool cap).

---

## Constants

```typescript
const GRID_SIZE  = 12
const CELL_SIZE  = 1.0
const TILE_SCALE: [number,number,number] = [1, 1, 1]
const MOVE_SPEED = 8.0          // units/s
const MOUSE_SENS = 0.002        // rad/px
const FOV_Y      = Math.PI / 4  // 45° — must match camera creation in main.ts
const PITCH_UPPER_BOUND = 0     // camera.pitch ≤ 0 always; 0 = horizontal, negative = looking down
const COLOR_HOVER_EMPTY:    [number,number,number,number] = [0.2, 0.5, 1.0, 0.4]
const COLOR_HOVER_OCCUPIED: [number,number,number,number] = [1.0, 0.85, 0.1, 0.45]
const COLOR_SELECTED:       [number,number,number,number] = [0.9, 0.3, 1.0, 0.5]
```

---

## State Object

```typescript
interface TileType { name: string; asset: FbxAssetHandle }
interface GridCell { handle: FbxModelHandle }

interface State {
  tiles: TileType[]                      // 10 randomly selected forest tiles
  grid: Map<number, GridCell>            // key = row*GRID_SIZE+col
  activeSlot: number                     // 0–9, drives hotbar highlight
  hoveredCell:  [number,number] | null   // locked-mode center-ray target
  selectedCell: [number,number] | null   // unlocked-mode click-selected cell
  highlight: Quad3DHandle
  hotbarSlotEls: HTMLElement[]
  lockHint: HTMLElement
  pointerLocked: boolean
  keys: Set<string>
  mat: Float32Array                      // reusable 16-float matrix (no per-frame alloc)
}
```

---

## Asset Loading

```typescript
// Vite resolves all 21 forest FBX URLs at build time
const allUrls = import.meta.glob(
  '../../src/assets/fbx/square_forest*.fbx',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>

// Fisher-Yates shuffle, pick first 10, load all in parallel
const assets = await Promise.all(chosen.map(([, url]) => engine.loadFbx(url)))
```

`deriveTileName(path)` strips prefix + `.fbx`:
`'../../src/assets/fbx/square_forest_roadA.fbx'` → `'roadA'`

---

## GPU Objects

| Object | Engine call | Notes |
|--------|-------------|-------|
| Floor mesh | `createMesh` | 4 verts + 2 tris. Vertex: `pos(12) pad(4) normal(12) pad(4) rgba(16)` = 48B |
| Grid lines | 26× `createQuad3D` | 13 constant-z lines (`width=0.05, height=12`). 13 constant-x lines (`width=12, height=0.05`). At y=0.003 |
| Cell highlight | `createQuad3D({ position:[0,0.01,0], color:[1,1,1,1], width:0.95, height:0.95 })` | Moved each frame via `setModelMatrix(translationMat)` + `setColor` |
| Crosshair dot | `createQuad2D({ x:-0.006, y:0.006, width:0.012, height:0.012, color:[1,1,1,0.85] })` | Static, never updated |
| Placed tiles | `createFbxModel(...)` per placement | Max 144; set `visible=false` on removal |

---

## Raycasting

### Center ray — locked mode
```typescript
function raycastCenter(camera: Camera): [number,number] | null {
  const [cx, cy, cz] = camera.position
  const dx = Math.sin(camera.yaw) * Math.cos(camera.pitch)
  const dy = -Math.sin(camera.pitch)
  const dz = -Math.cos(camera.yaw) * Math.cos(camera.pitch)
  if (dy >= -1e-6) return null
  const t = -cy / dy
  if (t < 0) return null
  const col = Math.floor((cx + t*dx) / CELL_SIZE)
  const row = Math.floor((cz + t*dz) / CELL_SIZE)
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null
  return [row, col]
}
```

### Mouse ray — unlocked mode
Reconstructs pixel ray from yaw/pitch basis vectors + FOV:
```typescript
function raycastMouse(e: MouseEvent, canvas: HTMLCanvasElement, camera: Camera): [number,number] | null {
  const rect   = canvas.getBoundingClientRect()
  const ndcX   = (e.clientX - rect.left) / rect.width  * 2 - 1
  const ndcY   = 1 - (e.clientY - rect.top) / rect.height * 2
  const tanH   = Math.tan(FOV_Y * 0.5)
  const aspect = canvas.width / canvas.height
  const vx = ndcX * aspect * tanH   // view-space ray X
  const vy = ndcY * tanH            // view-space ray Y  (vz = -1)

  // Camera basis (mirrors Camera._buildView)
  const { yaw: yw, pitch: p } = camera
  const cp = Math.cos(p), sp = Math.sin(p), cy2 = Math.cos(yw), sy = Math.sin(yw)
  const fx = sy*cp,  fy = -sp,   fz = -cy2*cp   // forward
  const rx = cy2,                rz = sy          // right (ry=0)
  const ux = sy*sp,  uy = cp,    uz = -cy2*sp    // up

  // World-space direction = R^T * (vx, vy, -1)
  const dx = rx*vx + ux*vy + fx
  const dy = 0 *vx + uy*vy + fy
  const dz = rz*vx + uz*vy + fz

  if (dy >= -1e-6) return null
  const t = -camera.position[1] / dy
  if (t < 0) return null
  const col = Math.floor((camera.position[0] + t*dx) / CELL_SIZE)
  const row = Math.floor((camera.position[2] + t*dz) / CELL_SIZE)
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null
  return [row, col]
}
```

---

## Interaction Modes

### Locked (pointer locked — navigate + build)
| Input | Action |
|-------|--------|
| WASD | Pan camera in yaw-only XZ plane |
| Mouse move | `camera.rotate(-dx*SENS, -dy*SENS)` then `camera.pitch = Math.min(PITCH_UPPER_BOUND, camera.pitch)` — NOTE: `camera.rotate()` already clamps to ±89°; our extra clamp is intentional to prevent looking up at all |
| Left click | Place `tiles[activeSlot]` at `hoveredCell` |
| Right click | Remove tile at `hoveredCell` |
| Keys 0–9 | Place `tiles[n]` at `hoveredCell`; set `activeSlot = n` |
| Esc | Release pointer lock |

### Unlocked (pointer free — select + hotbar)
| Input | Action |
|-------|--------|
| Click canvas — grid hit | Set `selectedCell`; do NOT lock cursor |
| Click canvas — no grid hit | `requestPointerLock()` |
| Click hotbar slot | Set `activeSlot`; if `selectedCell` set → place tile |
| Keys 0–9 | Set `activeSlot`; if `selectedCell` set → place tile |

---

## Highlight Logic (per logic frame)

```
locked  → activeDisplayCell = raycastCenter(camera) → store as hoveredCell
unlocked → activeDisplayCell = selectedCell

if activeDisplayCell:
  translate highlight to (col+0.5, 0.01, row+0.5) via setModelMatrix
  highlight.visible = true
  color = locked
    ? (occupied ? COLOR_HOVER_OCCUPIED : COLOR_HOVER_EMPTY)
    : COLOR_SELECTED
  highlight.setColor(...color)
else:
  highlight.visible = false
```

---

## Camera Movement (yaw-only, no pitch bleed)

Do NOT use `camera.move()` — it projects along pitch direction. Instead mutate `camera.position` directly:

```typescript
function applyMovement(camera: Camera, keys: Set<string>, dt: number): void {
  const speed = MOVE_SPEED * dt
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw)
  let mx = 0, mz = 0
  if (keys.has('KeyW')) { mx += sy; mz -= cy }
  if (keys.has('KeyS')) { mx -= sy; mz += cy }
  if (keys.has('KeyA')) { mx -= cy; mz -= sy }
  if (keys.has('KeyD')) { mx += cy; mz += sy }
  if (mx || mz) {
    const len = Math.sqrt(mx*mx + mz*mz)
    camera.position[0] += mx/len * speed
    camera.position[2] += mz/len * speed
  }
}
```

---

## Tile Placement / Removal

```typescript
function placeTile(engine, state, row, col, slotIdx) {
  const key = row * GRID_SIZE + col
  if (state.grid.has(key)) return   // no double-stacking
  const handle = engine.createFbxModel({
    asset: state.tiles[slotIdx].asset,
    position: [col + 0.5, 0, row + 0.5],
    scale: TILE_SCALE,
  })
  state.grid.set(key, { handle })
}

function removeTile(state, row, col) {
  const cell = state.grid.get(row * GRID_SIZE + col)
  if (!cell) return
  cell.handle.visible = false   // FbxModel.destroy() is a no-op; hide is enough
  state.grid.delete(row * GRID_SIZE + col)
}
```

---

## RAF Architecture

Two independent `requestAnimationFrame` loops:
1. **Engine RAF** (`engine.start()`) — renders, calls `Scene.frame()` → `camera.updateMatrices()` + `camera.uploadTo()`
2. **Logic RAF** (in `tileBuilder.ts`) — movement, raycasting, highlight, `dt` capped at 100ms

**Order matters:** start logic RAF **before** `engine.start()`. Reason: the engine RAF fires immediately on the next vsync. If `engine.start()` is called first, the first render frame can execute before any logic frame has run, producing one frame with stale camera state or an invisible highlight.

These loops are intentionally decoupled — do NOT merge them. The engine RAF must be the sole caller of `camera.updateMatrices()` / `camera.uploadTo()` (done internally by `Scene.frame()`). The logic RAF only mutates `camera.position`, `camera.yaw`, `camera.pitch`, and renderable properties.

---

## `main.ts` Bootstrap

```typescript
const camera = engine.createCamera({
  fovY: FOV_Y,   // imported from tileBuilder.ts — must match
  near: 0.1, far: 500,
  position: [6, 18, 16],
  yaw: 0,
  pitch: -(55 * Math.PI / 180),
})
engine.setCamera(camera)
await initTileBuilder(engine, camera, canvas)
engine.start()
```

---

## HTML Overlay Structure

Injected into `<div id="overlay">` by `tileBuilder.ts`:
- `#hotbar` — 10 `.hotbar-slot` at bottom-center, `pointer-events:auto`
- `#instructions` — top-left control reference panel
- `#lock-hint` — "Click to capture cursor", center screen, shown when unlocked

Crosshair is a `Quad2D` (GPU rendered), not HTML.

---

## Maintenance Notes

Critical context for anyone modifying this demo months or years later.

### FOV_Y must stay in sync with camera creation
`FOV_Y` in `tileBuilder.ts` is used to reconstruct the view frustum in `raycastMouse`. The camera's internal `_fovY` field is **private** — there is no getter. If `main.ts` changes `createCamera({ fovY: ... })` without updating `FOV_Y` in `tileBuilder.ts`, mouse picking silently breaks (clicks land on wrong cells). Always change both together.

### `camera.rotate()` has its own clamp — ours is intentional
`Camera.rotate()` clamps pitch to ±89°. The demo does an **additional** clamp: `camera.pitch = Math.min(PITCH_UPPER_BOUND, camera.pitch)` right after each `camera.rotate()` call. This intentionally prevents looking up at all (bird's-eye tile builder UX). Do not remove this line thinking the engine already handles clamping — it does, but to ±89°, not to 0°.

### `camera.position[1]` must always stay > 0
Movement code only modifies `position[0]` and `position[2]`. The Y coordinate is fixed at 18 (initial value). Both raycasting functions divide by `dy` after computing `t = -camera.position[1] / dy` — if Y ever reaches 0, the ray origin is on the ground plane and `t` becomes 0 (degenerate). Do not add vertical movement without updating the raycasting guard (`dy >= -1e-6`).

### Renderable pool cap
The engine supports up to **512 renderables** (UNIFORM_POOL_SIZE in Engine.ts). Current usage:
- 26 grid-line Quad3Ds
- 1 highlight Quad3D
- 1 crosshair Quad2D
- 1 floor Mesh
- Up to GRID_SIZE² = 144 FbxModels (tiles never freed, only hidden)
- **Total max: 173 / 512**

If you increase GRID_SIZE: recalculate. At GRID_SIZE = 21 you'd hit 441 + 29 = 470 (still safe). At GRID_SIZE = 22 you'd reach 484 + 29 = 513 — **over the cap** causing silent uniform slot exhaustion. The engine does not throw; tile placement silently fails.

### `visible = false` is the only tile removal
`FbxModel.destroy()` is intentionally a no-op — it preserves shared GPU asset buffers. Once a tile is created its uniform slot is permanently used. `removeTile()` sets `handle.visible = false` and removes from `state.grid` but does NOT reclaim the slot. Max 144 tiles × 1 slot each. This is fine for the demo's fixed grid but means you cannot "re-spawn" removed tiles as new objects without exceeding the expected slot count.

### `state.mat` is a shared scratch buffer
`state.mat` (Float32Array[16]) is reused every logic frame to build translation matrices for the highlight. It is **not safe to hold a reference** to it across frames or use it from two places in the same tick. It is a zero-allocation optimisation — if you add more transform updates in the loop, give each one its own buffer.

### `selectedCell` is never cleared on re-lock
By design: when the pointer is released (Esc), `selectedCell` persists so the purple highlight remains visible. When the pointer is re-locked (click empty canvas), `selectedCell` stays set — the next locked-mode hover overwrites `hoveredCell` but `selectedCell` is untouched until the user clicks a grid cell in unlocked mode. If you want selection to clear on lock, add `state.selectedCell = null` in the `pointerlockchange` handler when `pointerLocked` becomes true.

### Quad3D axis convention (non-obvious)
For Quad3D with `normal = [0, 1, 0]` (floor-facing):
- `width` = extent along **Z** (depth in world space)
- `height` = extent along **X** (width in world space)

The grid line comments use "constant-Z separator" (a line at a fixed Z, spanning X → large `height`) and "constant-X separator" (at fixed X, spanning Z → large `width`). If the lines appear rotated 90°, these two values are swapped.

### `contextmenu` event listener scope
Wire `contextmenu → preventDefault()` on the **canvas** element only, not `document`. Attaching to `document` would suppress right-click context menus everywhere on the page (outside the demo area).

### Asset glob and tile count
The glob `'../../src/assets/fbx/square_forest*.fbx'` matches exactly **21 files** (verified). The Fisher-Yates shuffle picks 10 of these. If the FBX directory gains or loses files matching this pattern, adjust the comment and check that 21 ≥ 10 (it always should be). The `_detail`, `_noSides`, and `_empty` variants are included in the pool — visually distinct, which is intentional variety.

---

## Verification Steps

1. `npm run dev` → `http://localhost:5173/demos/webgpu/`
2. Floor + grid lines visible; hotbar shows 10 tile names
3. "Click to capture cursor" hint shows at center
4. Click → cursor locks; WASD pans; mouse rotates; pitch never goes positive
5. Look at grid cell → blue highlight follows center dot
6. Press `3` → tile[3] placed at hovered cell
7. Look at occupied cell → yellow highlight
8. Right-click → tile removed
9. Esc → cursor free; purple persistent highlight on last hovered cell
10. Click grid cell (unlocked) → purple highlight moves to clicked cell
11. Click hotbar slot → tile placed at selected cell
12. Click empty canvas area → cursor re-locks
