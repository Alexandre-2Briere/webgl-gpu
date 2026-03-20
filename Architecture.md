# Architecture

Personal portfolio site for displaying interactive WebGPU/WebGL demos.
Built with **React 19 + TypeScript + Vite**, deployed on Apache (no backend).

The site has two tiers:
- **Main SPA** — React app at `/`. The homepage lists demos in a blog-like layout.
- **Demo pages** — standalone HTML apps at `/demos/<name>/`. Each runs independently with no React Router context.

---

## Repository Layout

| Path | Description |
|---|---|
| `index.html` | Vite HTML entry for the React SPA |
| `demos/` | Standalone demo entry points — one subdirectory per demo |
| `demos/webgpu/index.html` | HTML shell for the WebGPU Marching Cubes demo |
| `demos/webgpu/main.ts` | Bootstrap: wires `<canvas>` to `src/webgpu` module |
| `src/lib/projects/types.ts` | `ProjectMeta` TypeScript interface |
| `src/lib/projects/registry.ts` | Static array of all `ProjectMeta` objects — **source of truth** |
| `src/lib/services/fetchProjectMeta.ts` | Async accessor; swap body for `fetch()` to use an external API |
| `src/router/router.tsx` | `createBrowserRouter` — SPA routes only (`/`, future pages) |
| `src/App.tsx` | Thin `<RouterProvider>` wrapper — no logic |
| `src/main.tsx` | React app entry point; mounts `<App>` into `#root` |
| `src/pages/Home/Home.tsx` | Homepage: fetches project list, renders `<ProjectCard>` rows |
| `src/pages/Home/Home.module.css` | Homepage layout styles |
| `src/components/ProjectCard/ProjectCard.tsx` | Alternating image/text row card component |
| `src/components/ProjectCard/ProjectCard.module.css` | Card styles |
| `src/webgpu/` | WebGPU Marching Cubes demo source — do not reorganize internals |
| `src/webgpu/modules/marchingCubes/module.ts` | Public API: `initMarchingCubesModule(canvas)` |
| `src/index.css` | Global CSS reset and typography |
| `public/` | Static assets copied verbatim to `dist/` by Vite |
| `public/.htaccess` | Apache rewrite rules for SPA fallback and demo pass-through |
| `public/projects/` | Preview images for homepage cards (1200×630 recommended) |
| `vite.config.ts` | Multi-page build config: one `rollupOptions.input` entry per demo |
| `tsconfig.app.json` | TS config — includes `paths` matching the Vite aliases |
| `Architecture.md` | This file |

---

## Architectural Rules

1. **`src/lib/` is a pure data layer.** It must not import from `src/pages/`, `src/components/`, or `src/webgpu/`. It may be consumed by any layer above it.
2. **`src/webgpu/common/` must not import from `src/webgpu/modules/`.** This is an inherited constraint from the original demo codebase.
3. **Demo entries in `demos/` contain only bootstrap wiring.** No business logic, no state management — just canvas setup and a call to the module's init function.
4. **`/demos/*` is a filesystem namespace, not an SPA namespace.** Never add `/demos/*` routes to React Router. Apache serves these as real files.
5. **`registry.ts` is the sole source of truth for project metadata.** Do not duplicate title, description, or URL data in component files.
6. **Vite `rollupOptions.input` must have exactly one entry per subdirectory in `demos/`.** If they diverge, the `/read-architecture` skill will flag it.

---

## Adding a New Demo

1. Create `demos/<slug>/index.html` — minimal HTML shell with a `<canvas>` and a `<script type="module" src="./main.ts">`.
2. Create `demos/<slug>/main.ts` — import the demo's init function from `src/` and call it with the canvas element.
3. Add `'demo-<slug>': resolve(__dirname, 'demos/<slug>/index.html')` to `rollupOptions.input` in `vite.config.ts`.
4. Add a preview image to `public/projects/<slug>.jpg` (1200×630 recommended).
5. Add a `ProjectMeta` entry to `src/lib/projects/registry.ts`. Use `/project-description <slug>` to generate the object.
6. Run `npm run build` and confirm `dist/demos/<slug>/index.html` is produced.

---

## Deployment Notes

- Build output is `dist/`. Point Apache's `DocumentRoot` at this directory.
- `public/.htaccess` is copied to `dist/.htaccess` automatically by Vite — Apache will find it.
- No Node.js server, no SSR, no API proxy. All data is static.
- **Subdirectory deployment** (e.g., `example.com/portfolio/`): add `RewriteBase /portfolio/` to `.htaccess` and set `base: '/portfolio/'` in `vite.config.ts`.

---

## Path Aliases

These aliases are configured in both `vite.config.ts` and `tsconfig.app.json`:

| Alias | Resolves to |
|---|---|
| `@lib/*` | `src/lib/*` |
| `@components/*` | `src/components/*` |
| `@pages/*` | `src/pages/*` |
