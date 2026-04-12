import type { Engine, Camera, FbxAssetHandle, IGameObject, Quad3D } from '@engine';

// FOV_Y must match fovY in main.ts createCamera() call.
// raycastMouse() uses this to reconstruct the view frustum — if they diverge,
// mouse picking silently breaks (clicks land on wrong cells).
export const FOV_Y = Math.PI / 4;  // 45°

// ── Constants ────────────────────────────────────────────────────────────────

const GRID_SIZE  = 12;
const CELL_SIZE  = 1.0;
const TILE_SCALE: [number, number, number] = [0.5, 0.5, 0.5];
const MOVE_SPEED = 8.0;          // units/s

const ROAD_QUAD_Y     = TILE_SCALE[1] * 0.85;  // 85 % of tile height ≈ 0.425
const ROAD_QUAD_COLOR: [number, number, number, number] = [0.68, 0.52, 0.24, 1.0];
const MOUSE_SENS = 0.002;        // rad/px
const PITCH_LOWER_BOUND = 0;     // camera.pitch ≥ 0 always; 0 = horizontal, positive = looking down

const COLOR_HOVER_EMPTY:    [number, number, number, number] = [0.2,  0.5,  1.0,  0.4];
const COLOR_HOVER_OCCUPIED: [number, number, number, number] = [1.0,  0.85, 0.1,  0.45];
const COLOR_SELECTED:       [number, number, number, number] = [0.9,  0.3,  1.0,  0.5];

// ── Types ────────────────────────────────────────────────────────────────────

interface TileType { name: string; asset: FbxAssetHandle }
interface GridCell { handle: IGameObject; quad: IGameObject<Quad3D> }

interface State {
  tiles:         TileType[]
  grid:          Map<number, GridCell>
  activeSlot:    number
  hoveredCell:   [number, number] | null   // locked-mode center-ray target
  selectedCell:  [number, number] | null   // unlocked-mode click-selected cell
  highlight:     IGameObject<Quad3D>
  hotbarSlotEls: HTMLElement[]
  lockHint:      HTMLElement
  pointerLocked: boolean
  keys:          Set<string>
  mat:           Float32Array              // shared scratch: never hold a reference across frames
}

// ── Asset loading ────────────────────────────────────────────────────────────

function deriveTileName(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/^square_forest_road/, '').replace(/\.fbx$/i, '').replace(/_/g, '');
}

async function loadTileAssets(engine: Engine): Promise<TileType[]> {
  // Vite resolves all 10 road FBX URLs at build time
  const allUrls = import.meta.glob(
    '../../src/assets/fbx/square_forest_road*.fbx',
    { query: '?url', import: 'default', eager: true },
  ) as Record<string, string>;

  const entries = Object.entries(allUrls);
  const assets = await Promise.all(entries.map(([, url]) => engine.loadFbx(url)));

  return entries.map(([path], i) => ({ name: deriveTileName(path), asset: assets[i] }));
}

// ── Scene setup ──────────────────────────────────────────────────────────────

function createFloorMesh(engine: Engine): void {
  // 12×12 dark floor quad; vertex format: pos(12B) pad(4B) normal(12B) pad(4B) rgba(16B) = 48B
  const r = 0.06, g = 0.06, b = 0.08, a = 1.0;
  const nx = 0, ny = 1, nz = 0;
  const gs = GRID_SIZE * CELL_SIZE;
  // prettier-ignore
  const vertices = new Float32Array([
  //  px    py   pz   pad   nx   ny   nz   pad   r  g  b  a
      0,    0,   0,   0,    nx,  ny,  nz,  0,    r, g, b, a,
      gs,   0,   0,   0,    nx,  ny,  nz,  0,    r, g, b, a,
      gs,   0,   gs,  0,    nx,  ny,  nz,  0,    r, g, b, a,
      0,    0,   gs,  0,    nx,  ny,  nz,  0,    r, g, b, a,
  ]);
  const indices = new Uint32Array([0, 2, 1, 0, 3, 2]);
  engine.createMesh({ renderable: { vertices, indices, label: 'floor' } });
}

function createGridLines(engine: Engine): void {
  // Quad3D axis convention (normal=[0,1,0]): width = extent along Z, height = extent along X.
  // 13 constant-Z separators: thin in Z (width=0.05), full span in X (height=12)
  // 13 constant-X separators: full span in Z (width=12),  thin in X (height=0.05)
  const color: [number, number, number, number] = [0.25, 0.25, 0.28, 1.0];
  const gs = GRID_SIZE * CELL_SIZE;
  const half = gs / 2;
  const y = 0.003;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const coord = i * CELL_SIZE;
    // Constant-Z line: spans X, fixed Z
    engine.createQuad3D({ renderable: { normal: [0, 1, 0], width: 0.05, height: gs,   color, label: `gridZ${i}` }, position: [half,  y, coord] });
    // Constant-X line: spans Z, fixed X
    engine.createQuad3D({ renderable: { normal: [0, 1, 0], width: gs,   height: 0.05, color, label: `gridX${i}` }, position: [coord, y, half]  });
  }
}

function createHighlight(engine: Engine): IGameObject<Quad3D> {
  // Moved each frame via setModelMatrix; color set via setColor.
  // Baked at origin — position is purely a starting value, overwritten immediately.
  return engine.createQuad3D({
    renderable: { normal: [0, 1, 0], width: 0.95, height: 0.95, color: [1, 1, 1, 1], label: 'highlight' },
    position: [0, 0.01, 0],
  });
}

// ── DOM overlay ──────────────────────────────────────────────────────────────

function buildHotbarUI(overlay: HTMLElement, tiles: TileType[], activeSlot: number): HTMLElement[] {
  const hotbar = document.createElement('div');
  hotbar.id = 'hotbar';

  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i === activeSlot ? ' active' : '');

    const badge = document.createElement('span');
    badge.className = 'key-badge';
    badge.textContent = String(i);

    const name = document.createElement('span');
    name.className = 'tile-name';
    name.textContent = tiles[i]?.name ?? '';

    slot.appendChild(badge);
    slot.appendChild(name);
    hotbar.appendChild(slot);
  }

  overlay.appendChild(hotbar);
  return Array.from(hotbar.querySelectorAll<HTMLElement>('.hotbar-slot'));
}

function buildInstructions(overlay: HTMLElement): void {
  const el = document.createElement('div');
  el.id = 'instructions';
  el.innerHTML =
    '<div class="section-label">Locked</div>' +
    'WASD — move<br>' +
    'Space/Shift — up/down<br>' +
    'Mouse — look<br>' +
    'LMB — place tile<br>' +
    'RMB — remove tile<br>' +
    '0–9 — select &amp; place<br>' +
    'Esc — release cursor' +
    '<div class="section-label">Unlocked</div>' +
    'Click grid — select cell<br>' +
    'Click hotbar — place tile<br>' +
    'Click empty — lock cursor';
  overlay.appendChild(el);
}

function buildLockHint(overlay: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.id = 'lock-hint';
  el.textContent = 'Click to capture cursor';
  overlay.appendChild(el);
  return el;
}

function updateHotbarUI(state: State): void {
  state.hotbarSlotEls.forEach((el, i) => {
    el.classList.toggle('active', i === state.activeSlot);
  });
}

// ── Placement / Removal ──────────────────────────────────────────────────────

function placeTile(engine: Engine, state: State, row: number, col: number, slotIdx: number): void {
  const key = row * GRID_SIZE + col;
  if (state.grid.has(key)) return;   // no double-stacking
  const handle = engine.createFbxModel({
    renderable: { asset: state.tiles[slotIdx].asset },
    position: [col + 0.5, 0, row + 0.5],
    scale:    TILE_SCALE,
  });
  const quad = engine.createQuad3D({
    renderable: {
      normal:  [0, 1, 0],
      width:   CELL_SIZE * 0.92,
      height:  CELL_SIZE * 0.92,
      color:   ROAD_QUAD_COLOR,
      label:   `road-surface-${row}-${col}`,
    },
    position: [col + 0.5, ROAD_QUAD_Y, row + 0.5],
  });
  state.grid.set(key, { handle, quad });
}

function removeTile(state: State, row: number, col: number): void {
  const key  = row * GRID_SIZE + col;
  const cell = state.grid.get(key);
  if (!cell) return;
  cell.handle.renderable.visible = false;   // FbxModel.destroy() is a no-op; hide is enough
  cell.quad.renderable.visible = false;
  state.grid.delete(key);
}

// ── Input wiring ─────────────────────────────────────────────────────────────

function wireInput(engine: Engine, camera: Camera, canvas: HTMLCanvasElement, state: State): void {
  window.addEventListener('keydown', e => {
    state.keys.add(e.code);

    const match = e.code.match(/^Digit(\d)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      state.activeSlot = n;
      updateHotbarUI(state);
      if (state.pointerLocked && state.hoveredCell) {
        placeTile(engine, state, state.hoveredCell[0], state.hoveredCell[1], n);
      } else if (!state.pointerLocked && state.selectedCell) {
        placeTile(engine, state, state.selectedCell[0], state.selectedCell[1], n);
      }
    }
  });

  window.addEventListener('keyup', e => { state.keys.delete(e.code); });

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    state.lockHint.style.display = state.pointerLocked ? 'none' : '';
  });

  window.addEventListener('mousemove', e => {
    if (!state.pointerLocked) return;
    camera.rotate(+e.movementX * MOUSE_SENS, +e.movementY * MOUSE_SENS);
    // extra clamp: engine clamps ±89°; we also disallow looking up (pitch must stay ≥ 0)
    camera.pitch = Math.max(PITCH_LOWER_BOUND, camera.pitch);
  });

  canvas.addEventListener('mousedown', e => {
    if (!state.pointerLocked) return;
    if (e.button === 0 && state.hoveredCell) {
      placeTile(engine, state, state.hoveredCell[0], state.hoveredCell[1], state.activeSlot);
    } else if (e.button === 2 && state.hoveredCell) {
      removeTile(state, state.hoveredCell[0], state.hoveredCell[1]);
    }
  });

  canvas.addEventListener('click', e => {
    if (state.pointerLocked) return;
    const cell = raycastMouse(e, canvas, camera);
    if (cell) {
      state.selectedCell = cell;
    } else {
      canvas.requestPointerLock();
    }
  });

  state.hotbarSlotEls.forEach((el, i) => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      state.activeSlot = i;
      updateHotbarUI(state);
      if (state.selectedCell) {
        placeTile(engine, state, state.selectedCell[0], state.selectedCell[1], i);
      }
    });
  });

  // Suppress right-click context menu on canvas only (not on document)
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ── Raycasting ───────────────────────────────────────────────────────────────

function raycastCenter(camera: Camera): [number, number] | null {
  const [cx, cy, cz] = camera.position;
  const dx = Math.sin(camera.yaw) * Math.cos(camera.pitch);
  const dy = -Math.sin(camera.pitch);
  const dz = -Math.cos(camera.yaw) * Math.cos(camera.pitch);
  if (dy >= -1e-6) return null;
  const t = -cy / dy;
  if (t < 0) return null;
  const col = Math.floor((cx + t * dx) / CELL_SIZE);
  const row = Math.floor((cz + t * dz) / CELL_SIZE);
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  return [row, col];
}

function raycastMouse(e: MouseEvent, canvas: HTMLCanvasElement, camera: Camera): [number, number] | null {
  const rect  = canvas.getBoundingClientRect();
  const ndcX  = (e.clientX - rect.left) / rect.width  * 2 - 1;
  const ndcY  = 1 - (e.clientY - rect.top)  / rect.height * 2;
  const tanH  = Math.tan(FOV_Y * 0.5);
  const aspect = canvas.width / canvas.height;
  const vx = ndcX * aspect * tanH;   // view-space ray X
  const vy = ndcY * tanH;            // view-space ray Y  (vz = -1)

  // Camera basis (mirrors Camera._buildView)
  const { yaw: yw, pitch: p } = camera;
  const cp = Math.cos(p), sp = Math.sin(p), cy2 = Math.cos(yw), sy = Math.sin(yw);
  const fx = sy * cp,  fy = -sp,       fz = -cy2 * cp;   // forward
  const rx = cy2,                       rz = sy;           // right (ry=0)
  const ux = sy * sp,  uy = cp,        uz = -cy2 * sp;    // up

  // World-space direction = R^T * (vx, vy, -1)
  const dx = rx * vx + ux * vy + fx;
  const dy = 0  * vx + uy * vy + fy;
  const dz = rz * vx + uz * vy + fz;

  if (dy >= -1e-6) return null;
  const t = -camera.position[1] / dy;
  if (t < 0) return null;
  const col = Math.floor((camera.position[0] + t * dx) / CELL_SIZE);
  const row = Math.floor((camera.position[2] + t * dz) / CELL_SIZE);
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  return [row, col];
}

// ── Movement ─────────────────────────────────────────────────────────────────

function applyMovement(camera: Camera, keys: Set<string>, dt: number): void {
  // Yaw-only XZ movement — do NOT use camera.move() (it bleeds pitch direction into Y)
  const speed = MOVE_SPEED * dt;
  const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw);
  let mx = 0, mz = 0;
  if (keys.has('KeyW')) { mx += sy; mz -= cy; }
  if (keys.has('KeyS')) { mx -= sy; mz += cy; }
  if (keys.has('KeyA')) { mx -= cy; mz -= sy; }
  if (keys.has('KeyD')) { mx += cy; mz += sy; }
  if (mx || mz) {
    const len = Math.sqrt(mx * mx + mz * mz);
    camera.position[0] += mx / len * speed;
    camera.position[2] += mz / len * speed;
  }
  if (keys.has('Space'))                                      { camera.position[1] += speed; }
  if (keys.has('ShiftLeft') || keys.has('ShiftRight'))        { camera.position[1] -= speed; }
}

// ── Highlight matrix helper ───────────────────────────────────────────────────

function makeTranslationMat(x: number, y: number, z: number, out: Float32Array): void {
  // Column-major identity with translation in column 3
  out.fill(0);
  out[0]  = 1;
  out[5]  = 1;
  out[10] = 1;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;
}

// ── Logic RAF ────────────────────────────────────────────────────────────────

function startLogicRAF(camera: Camera, state: State): void {
  let last = performance.now();

  const tick = (now: number): void => {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1);  // cap at 100ms
    last = now;

    if (state.pointerLocked) {
      applyMovement(camera, state.keys, dt);
      state.hoveredCell = raycastCenter(camera);
    }

    const activeDisplayCell = state.pointerLocked ? state.hoveredCell : state.selectedCell;

    if (activeDisplayCell) {
      const [row, col] = activeDisplayCell;
      makeTranslationMat(col + 0.5, 0.01, row + 0.5, state.mat);
      state.highlight.renderable.setModelMatrix(state.mat);
      state.highlight.renderable.visible = true;

      const occupied = state.grid.has(row * GRID_SIZE + col);
      if (state.pointerLocked) {
        state.highlight.renderable.setColor(...(occupied ? COLOR_HOVER_OCCUPIED : COLOR_HOVER_EMPTY));
      } else {
        state.highlight.renderable.setColor(...COLOR_SELECTED);
      }
    } else {
      state.highlight.renderable.visible = false;
    }
  };

  requestAnimationFrame(tick);
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function initTileBuilder(
  engine: Engine,
  camera: Camera,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const overlay = document.getElementById('overlay') as HTMLDivElement;

  const tiles = await loadTileAssets(engine);

  // Pool cap: 26 grid-line Quad3Ds + 1 highlight + 1 crosshair + 1 floor Mesh + GRID_SIZE²=144 FbxModels (max) = 173 / 512 cap
  createFloorMesh(engine);
  createGridLines(engine);
  const highlight = createHighlight(engine);
  highlight.renderable.visible = false;   // hidden until first logic tick places it correctly

  // Crosshair: 0.012×0.012 white dot at screen center
  // NDC top-left corner: x=-0.006 places left edge, y=0.006 places top edge
  engine.createQuad2D({ renderable: { x: -0.006, y: 0.006, width: 0.012, height: 0.012, color: [1, 1, 1, 0.85], label: 'crosshair' } });

  const state: State = {
    tiles,
    grid:          new Map(),
    activeSlot:    0,
    hoveredCell:   null,
    selectedCell:  null,
    highlight,
    hotbarSlotEls: buildHotbarUI(overlay, tiles, 0),
    lockHint:      buildLockHint(overlay),
    pointerLocked: false,
    keys:          new Set(),
    mat:           new Float32Array(16),
  };

  buildInstructions(overlay);
  updateHotbarUI(state);
  wireInput(engine, camera, canvas, state);

  // Logic RAF must start before engine.start() — see main.ts comment
  startLogicRAF(camera, state);
}
