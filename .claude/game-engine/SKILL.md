# WebGPU Game Engine — Constraints

This file is the canonical constraint registry for the WebGPU 3D game engine project.
It is updated whenever a new architectural constraint is agreed upon during planning.

---

## Scope

- All engine source code lives in `src/webgpu/`.
- The demo entry point is `demos/webgpu/index.html` and `demos/webgpu/main.ts`.
- No engine logic goes outside these two paths. The React SPA (`src/`, `src/components/`, `src/pages/`) must not be modified for engine work.

---

## Layer Isolation

- `src/webgpu/common/` must **never** import from `src/webgpu/modules/`.
- Cross-layer wiring is done exclusively via injected callbacks passed through constructors.

---

## Module Structure

Each engine module lives under `src/webgpu/modules/<module-name>/` and follows this layout:

```
src/webgpu/modules/<module-name>/
├── module.ts          # Entry point / init
├── renderer.ts        # Render loop and GPU resource management
├── constants/         # Module-specific constants
├── utils/             # Module-specific utilities
└── shaders/           # WGSL shaders (co-located with the module)
```

Shared, cross-module code lives in `src/webgpu/common/`.

---

## Demo Bootstrap Rule

`demos/webgpu/main.ts` contains only wiring and initialization logic (adapter/device setup, module init call). No business logic, rendering code, or engine state belongs there.

---

## Shader Convention

Shaders (`.wgsl`) live co-located with the module that owns them (`src/webgpu/modules/<module-name>/shaders/`). There is no top-level shaders folder.

---

## Constraint Evolution

Whenever a new architectural constraint is agreed upon during a planning session, it is appended to this file under the relevant section (or a new section is created). The constraint must include a brief rationale.
