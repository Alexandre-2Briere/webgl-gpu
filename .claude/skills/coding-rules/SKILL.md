---
title: coding-rules
description: TypeScript coding rules — enforce all rules whenever writing or editing a .ts file
---

# TypeScript Coding Rules

This file is the canonical coding-rules registry for all TypeScript files in this project.
Whenever the user says "add a coding rule", append the new rule to the list below.

---

## Rules

1. **No any/unknown** — Never use `any` or `unknown` as a type.
2. **One instruction per line** — Never write multiple instructions on the same line.
3. **Always brace if/else** — Every `if`, `else if`, and `else` block must use `{}`.
4. **Import via index.ts** — When importing from outside your direct folder, always import from the nearest `index.ts` barrel (child, sibling, or parent). Never deep-import across folder boundaries.
5. **Prefer math helpers** — Always use an existing math helper function when one applies.
6. **Create missing math helpers** — If a math operation may repeat and no helper exists, create one before using raw math inline.
7. **Reuse existing types** — Always use an existing type when it fits; do not duplicate types.
