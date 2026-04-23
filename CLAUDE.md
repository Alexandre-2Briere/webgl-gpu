# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The main rule : NEVER and i mean NEVER try to access file outside the project

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # tsc -b + Vite production build → dist/
npm run lint      # ESLint across all .ts/.tsx files
npm run preview   # Serve dist/ locally
npm run test      # Vitest (pattern: src/webgpu/engine/tests/**/*.test.ts)
```

NEVER use command not in this list
You may ask for user permission but assume it will be no.

## Architecture Overview

Personal portfolio site for interactive WebGPU demos. React 19 + TypeScript + Vite, deployed as a static site on Apache (no backend).

### Coding Rules
NEVER use abbreviation always us complete name, it's not dt it's deltaTime
ALWAYS fix the root cause and not the symptom
ALWAYS ask question in case of multiple solution possible
NEVER repeat yourself unless ask specificly

### Search Rules
NEVER run `grep`, `find`, or any search shell command directly.
When you need to search for a file or pattern, give the exact command to the user and wait for them to paste the result.
The only file-access tool allowed by default is `Read` (for known paths).

### Two-Tier Structure

**Tier 1 — React SPA (`/`)**
Entry: `index.html` → `src/main.tsx` → React Router → `src/pages/Home/Home.tsx`
Fetches project list from `src/lib/services/fetchProjectMeta.ts`, renders `<ProjectCard>` rows.

**Tier 2 — Standalone Demo Pages (`/demos/<slug>/`)**
Entry: `demos/<slug>/index.html` + `demos/<slug>/main.ts`
Plain TypeScript, no React. Each demo imports its init function from `src/webgpu/` and wires it to a `<canvas>`. Demo entries must contain **only bootstrap wiring** — no business logic.

### Data Layer (`src/lib/`)

Pure data, no imports from pages/components/webgpu.

- `src/lib/projects/registry.ts` — static array of `ProjectMeta` objects, **sole source of truth** for project metadata. Do not duplicate titles/URLs in component files.
- `src/lib/projects/types.ts` — `ProjectMeta` interface
- `src/lib/services/fetchProjectMeta.ts` — async accessor (swap body for `fetch()` to use an external API)

### WebGPU Engine (`src/webgpu/engine/`)

Lightweight modular 3D rendering engine, ~5 K lines. See `src/webgpu/engine/README.md` for the full API reference.

**Key invariants:**
- `Engine.create(canvas, opts?)` is an async factory — the only way to get an `Engine`.
- `setCamera()` must be called before `start()`. UniformPool starts at 512 slots and grows automatically in 512-slot chunks as needed.
- Two independent RAFs: the engine's render loop (`engine.start()`) and a caller-managed physics/logic loop that calls `applyPhysics` + `applyCollisions`.

**Frame order per tick:**
1. Compute pre-pass (zeroes `IndirectBuffer`, dispatches compute shaders for `ComputedRenderable` objects)
2. World pass — depth-tested 3D renderables (`layer: 'world'`)
3. Overlay pass — composited 2D renderables (`layer: 'overlay'`, no depth test)

**Renderable types:** `Mesh` (static), `ComputedMesh` (GPU compute / marching cubes), `Quad2D` (screen-space HUD), `Quad3D` (world-space), `Model3D` / `FbxModel` (loaded assets).

**Vertex format (48 bytes, interleaved):** `vec3f pos | f32 pad | vec3f normal | f32 pad | vec4f color`

**Physics:** `Rigidbody3D` + hitbox types (`SphereHitbox`, `CubeHitbox`, `CapsuleHitbox`, `MeshHitbox`). Bodies only collide within the same `layer` string. `rigidbodyOffset` separates visual center from physics center (local space, rotated by object quaternion).

**Resource lifecycle:** Create → mutate via handle methods → optionally hide (`visible = false`) → `destroy()`. `destroy()` returns the uniform slot to the pool freelist for reuse.

## Architectural Rules

1. `src/lib/` must not import from `src/pages/`, `src/components/`, or `src/webgpu/`.
2. `src/webgpu/common/` must not import from `src/webgpu/modules/`.
3. Demo entries in `demos/` contain only bootstrap wiring — canvas setup and a single init call.
4. `/demos/*` are real filesystem paths served by Apache. **Never add them to React Router.**
5. `registry.ts` is the sole source of truth for project metadata.
6. `vite.config.ts` `rollupOptions.input` must have exactly one entry per subdirectory in `demos/`.

## Adding a New Demo

1. Create `demos/<slug>/index.html` (minimal HTML shell with `<canvas>` and `<script type="module" src="./main.ts">`)
2. Create `demos/<slug>/main.ts` (import init function from `src/`, call with canvas)
3. Add `'demo-<slug>': resolve(__dirname, 'demos/<slug>/index.html')` to `rollupOptions.input` in `vite.config.ts`
4. Add preview image to `public/projects/<slug>.jpg` (1200×630)
5. Add `ProjectMeta` entry to `src/lib/projects/registry.ts` (use `/project-description <slug>`)
6. Run `npm run build` and confirm `dist/demos/<slug>/index.html` is produced

## Path Aliases

| Alias | Resolves to |
|---|---|
| `@lib/*` | `src/lib/*` |
| `@components/*` | `src/components/*` |
| `@pages/*` | `src/pages/*` |

## Deployment

Build output is `dist/`. Point Apache's `DocumentRoot` at it. `public/.htaccess` is copied automatically and handles SPA fallback + demo pass-through. No Node.js server, no SSR. Subdirectory deployment requires `RewriteBase` in `.htaccess` and `base` in `vite.config.ts`.

## Known Vulnerabilities

Tracked in `Vuln.md` — three low-severity open issues (OBJ parser bounds-checking, camera GPU buffer leak on `setCamera()` replacement, FBX texture decode errors suppressed silently). Use `/fix-vuln` skill to fix and remove entries.
