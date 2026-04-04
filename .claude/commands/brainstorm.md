---
name: brainstorm
description: Clarify an idea through back-and-forth Q&A until specs are ready for /plan
invocation: /brainstorm
---

The user has an idea they want to develop into a clear spec before writing an implementation plan. Your job is to run a focused dialogue — asking targeted questions round by round — until the idea is concrete enough to hand off to plan mode. Do not write code, suggest implementations, or enter plan mode yourself.

## Rules

1. Ask at most 3 questions per round. Pick only the unknowns that most block a concrete spec.
2. Never re-ask a question the user has already answered.
3. Stay in dialogue mode only — no code, no implementation steps, no architecture proposals.
4. When the user types `done` or `enough`, stop asking and emit the Spec Summary immediately, marking unresolved items as `TBD`.
5. The final Spec Summary must be self-contained so the user can paste it directly into a `/plan` prompt.

## Steps

### Step 1 — Receive the idea

Read the text following `/brainstorm`. If nothing was provided, ask the user to describe their idea in one or two sentences before continuing.

### Step 2 — Identify unknowns and ask questions (repeat until specs are clear)

Each round:

1. Review everything established so far (goal, inputs/outputs, constraints, scope boundaries, success criteria, edge cases).
2. Identify the 1–3 unknowns that most prevent a concrete spec.
3. Ask only those questions — numbered, one per line.
4. Wait for the user's reply, then loop back to step 2.

Exit this loop when you can answer all of the following without ambiguity:
- What problem does this solve, and for whom?
- What are the inputs and outputs (or trigger and observable result)?
- What are the hard constraints (performance, API surface, file locations, etc.)?
- What is explicitly out of scope?
- What does "done" look like (success criteria)?

### Step 3 — Emit Spec Summary and hand off

Once specs are clear (or the user says `done`/`enough`), output:

---
**Specs are clear. Here is the summary:**

## Spec Summary

**Goal:** [one sentence]

**Inputs / Trigger:** [what kicks this off]

**Outputs / Observable result:** [what the user sees or gets]

**Constraints:**
- [constraint 1]
- [constraint 2]

**Out of scope:**
- [item 1]

**Success criteria:**
- [criterion 1]

**Open decisions resolved:**
- [decision and chosen answer]

---

Then tell the user: "You can now invoke `/plan` and paste this summary as context."
