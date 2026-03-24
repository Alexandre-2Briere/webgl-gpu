# TODO: Tile-Builder Demo

## Phase 1 — Scaffold
- [ ] Rewrite `demos/webgpu/index.html` — canvas + overlay `<div>` + all CSS
- [ ] Rewrite `demos/webgpu/main.ts` — Engine.create, camera setup (`FOV_Y`, pos, pitch), call `initTileBuilder`, `engine.start()`
- [ ] Create `demos/webgpu/tileBuilder.ts` — empty module with `export async function initTileBuilder(...)`

## Phase 2 — Asset Loading
- [ ] Implement `loadTileAssets(engine)` using `import.meta.glob` for all `square_forest*.fbx`
- [ ] Fisher-Yates shuffle, pick 10, `Promise.all(engine.loadFbx(...))`
- [ ] Implement `deriveTileName(path)` — strip prefix + `.fbx`

## Phase 3 — Scene Setup
- [ ] `createFloorMesh(engine)` — dark 12×12 quad, correct 48B vertex format
- [ ] `createGridLines(engine)` — 26 thin `Quad3D` strips at y=0.003
  - [ ] 13 lines along X (constant-z separators): `width=0.05, height=12`
  - [ ] 13 lines along Z (constant-x separators): `width=12, height=0.05`
- [ ] `createHighlight(engine)` — `Quad3D` at origin with `color:[1,1,1,1]`, 0.95×0.95
- [ ] Crosshair — `createQuad2D` at center, 0.012×0.012, white

## Phase 4 — DOM Overlay
- [ ] `buildHotbarUI(overlay, state)` — 10 slots with key badge + tile name
- [ ] `buildInstructions(overlay)` — top-left control reference
- [ ] `buildLockHint(overlay)` — center-screen "Click to capture cursor"
- [ ] `updateHotbarUI(state)` — toggle `.active` class on active slot

## Phase 5 — Input Wiring
- [ ] `keydown` / `keyup` → maintain `state.keys` Set
- [ ] `Digit0–9` keydown → set `activeSlot`, call `updateHotbarUI`
- [ ] `pointerlockchange` → update `state.pointerLocked`, show/hide lock hint
- [ ] `mousemove` (locked) → `camera.rotate(-dx*SENS, -dy*SENS)` then `camera.pitch = Math.min(PITCH_UPPER_BOUND, camera.pitch)` (engine clamps ±89°; our clamp prevents looking up)
- [ ] `mousedown` button 0 (locked) → `placeTile` at `hoveredCell`
- [ ] `mousedown` button 2 (locked) → `removeTile` at `hoveredCell`
- [ ] `click` canvas (unlocked) → `raycastMouse`; if grid hit → `selectedCell`; else `requestPointerLock()`
- [ ] `click` hotbar slot (unlocked) → set `activeSlot`; if `selectedCell` → `placeTile`
- [ ] `contextmenu` on **canvas** → `preventDefault()` (canvas only, not document)

## Phase 6 — Logic RAF
- [ ] `applyMovement(camera, keys, dt)` — yaw-only XZ movement (do NOT use `camera.move()`)
- [ ] `raycastCenter(camera)` — center ray → y=0 plane → grid cell
- [ ] `raycastMouse(e, canvas, camera)` — pixel ray → y=0 plane → grid cell
- [ ] Highlight update loop:
  - [ ] Locked: `hoveredCell = raycastCenter()`
  - [ ] Unlocked: `activeDisplayCell = selectedCell`
  - [ ] `setModelMatrix(translationMat)` + `setColor(...)` or `visible=false`
- [ ] `makeTranslationMat(x, y, z, out)` — fills 16-float identity + translation

## Phase 7 — Placement / Removal
- [ ] `placeTile(engine, state, row, col, slotIdx)` — `createFbxModel`, store in `state.grid`
- [ ] `removeTile(state, row, col)` — `handle.visible = false`, delete from `state.grid`

## Phase 8 — Polish & Test
- [ ] Verify tiles appear at correct cell centers
- [ ] Verify alpha highlights render correctly (no z-fighting with floor)
- [ ] Verify TILE_SCALE looks right — adjust if tiles are too big/small
- [ ] Verify `selectedCell` persists and clears correctly when re-locking
- [ ] Verify 0–9 hotbar selection and number-key placement both work
- [ ] Verify right-click removal works
- [ ] Check console for any WebGPU validation errors

## Phase 9 — Maintenance Hardening
- [ ] Assert `FOV_Y` in `tileBuilder.ts` matches `fovY` in `main.ts` `createCamera()` call — add co-located comment in both files
- [ ] Document pool cap in code: `// 26 lines + 1 highlight + 1 crosshair + 1 floor + GRID_SIZE²(max 144) = 173 / 512 cap`
- [ ] Confirm logic RAF is started before `engine.start()` — add comment explaining the ordering requirement
- [ ] Confirm `state.mat` is only written from one place per tick — add `// shared scratch: never hold a reference across frames` comment
- [ ] Confirm `contextmenu` listener is attached to `canvas`, not `document`
- [ ] Confirm `camera.pitch` manual clamp is preserved after `camera.rotate()` call — add inline comment: `// extra clamp: engine clamps ±89°; we also disallow looking up`
