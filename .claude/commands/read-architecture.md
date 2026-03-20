---
description: Load project architecture and registry into context before working
---

Read the following files to understand the current project state before starting any implementation task:

1. `Architecture.md` — full file listing, architectural rules, and constraints
2. `src/lib/projects/registry.ts` — current list of registered demos
3. `src/lib/projects/types.ts` — ProjectMeta interface
4. `vite.config.ts` — multi-page build entries

After reading, report:
- **Projects registered:** how many entries are in `registry.ts`
- **Vite demo entries:** which demos are listed in `rollupOptions.input`
- **Mismatches:** any project in `registry.ts` with no matching Vite entry, or any Vite entry with no matching registry entry

This skill is read-only — do not make any changes.
