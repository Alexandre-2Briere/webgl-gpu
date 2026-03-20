---
description: Generate a ProjectMeta entry for a new demo project
---

You are helping maintain the project registry at `src/lib/projects/registry.ts`.

Given the demo at `demos/$ARGUMENTS/`, produce a complete `ProjectMeta` TypeScript object literal ready to paste into `registry.ts`.

## Steps

1. Read `Architecture.md` for overall project context.
2. Read `demos/$ARGUMENTS/main.ts` (or `main.tsx`) to identify the technology stack.
3. Read `demos/$ARGUMENTS/index.html` for the page title if set.
4. Check `src/lib/projects/types.ts` to confirm the current `ProjectMeta` interface.

## Output format

Produce only the TypeScript object literal — no surrounding code, no explanation:

```ts
{
  id: '<url-safe-slug>',
  title: '<human-readable title, max 60 chars>',
  shortDescription: '<one to two sentences, plain text, suitable for homepage card>',
  previewImage: '/projects/<slug>.jpg',
  demoUrl: '/demos/<slug>/',
  tags: ['...'], // infer from tech stack
  publishedAt: '<today ISO date>',
},
```

After outputting the object, remind the user to:
- Add the preview image at `public/projects/<slug>.jpg` (1200×630 recommended)
- Add the entry to `rollupOptions.input` in `vite.config.ts`
