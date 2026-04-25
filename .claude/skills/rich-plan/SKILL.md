---
name: rich-plan
description: Produce a rich, human-readable plan file with TL;DR, [CHANGED]/[ADDED]/[REMOVED] step tags, ASCII diagrams, and diff blocks use this when in planning mode, or when the user explicitly requests a rich plan. always use this format for the plan file — never the default format.
---

The user wants a detailed implementation plan. Your job is to research the
codebase, design the approach, and write a plan file. The plan must be
richer and more human-readable than the default format — every step tagged,
diagrams present where relevant, diff blocks for all code changes.

## Rules

1. Every step must be prefixed with exactly one of: [CHANGED], [ADDED], or [REMOVED].
2. The plan file must open with a TL;DR section (one paragraph) before any other section.
3. Include at least one ASCII art diagram for any plan that touches inter-file
   dependencies, interfaces, or call sequences.
4. Use diff-fenced code blocks wherever the plan describes code additions or removals.
5. Diagrams must be ASCII only — no Mermaid, no HTML, no SVG.
6. Convey color through diff blocks only — no HTML <span> tags.
7. The plan must be valid Markdown that renders in VS Code and GitHub without plugins.
8. Plan quality must equal or exceed the default plan agent — never reduce detail
   or actionability to achieve formatting goals.
9. Write the plan to the path provided by the harness in the system-reminder
   (look for "You should create your plan at <path>"). Use that exact path.

## Step 1 — Research

Launch up to 3 Explore agents IN PARALLEL (single message, multiple tool calls)
to understand the task scope:

- Use 1 agent when the task is isolated to known files or the user provided
  specific file paths.
- Use multiple agents when scope is uncertain, multiple codebase areas are
  involved, or you need to understand existing patterns before planning.
- Give each agent a specific search focus. Quality over quantity — 3 maximum.

## Step 2 — Design

Launch 1 Plan agent with:
- Comprehensive background from Step 1: file paths, function names, code paths.
- All user requirements and constraints.
- A request for a detailed, step-by-step implementation plan.

## Step 3 — Write the plan file

Write the plan to the path the harness provided in the system-reminder.
Use the Write tool — do not print the plan in the conversation.

---

### Required plan file structure

#### TL;DR (mandatory, first section)

One paragraph: what is being built or changed, why, and what the end-state
looks like. Must appear before all other sections.

#### Context

Why this change is being made — the problem it addresses, what prompted it,
and the intended outcome.

#### Changes

One subsection per logical change, using this format:

    ### [CHANGED | ADDED | REMOVED] <Title>

    **File:** `<path>`

    <Prose: what changes and why.>

    ```diff
    - old line or signature
    + new line or signature
    ```

    <ASCII diagram — only when the change affects inter-file dependencies,
     a public interface shape, or a call sequence.>

#### ASCII diagram guidance (apply inline, not in a separate section)

Dependency change:

    Before:                      After:
      A ──► B ──► C               A ──► B ──► C
                                         │
                                         ▼
                                         D

Call sequence:

    Caller ──► FunctionA ──► FunctionB
                    │
                    ▼
                FunctionC

Interface shape:

    Before:                        After:
    ┌──────────────────┐           ┌─────────────────────────┐
    │ InterfaceX       │           │ InterfaceX              │
    │  foo(): void     │  ──────►  │  foo(): void            │
    │                  │           │  bar(n: number): string │
    └──────────────────┘           └─────────────────────────┘

#### Verification

Bulleted checklist: which commands to run, which UI flows to exercise,
which tests to check. Reference commands from CLAUDE.md only.

---

## Step 4 — Signal completion

Call `ExitPlanMode` to hand off to the harness. The harness reads the plan file
and presents it to the user for approval. Do not print the path or ask for
confirmation in text — ExitPlanMode handles that.

## Step 5 — Print summary table in chat

After writing the plan file, always output a Markdown summary table directly in the conversation. The table must list every changed file, what is being done to it, and the net line delta. Use this format:

| File | Change | Lines Δ |
|---|---|---|
| `src/foo/bar.ts` | merge @engine type+value imports | -2 |

End with a one-sentence total (e.g. "**9 files, ~23 lines removed.**").