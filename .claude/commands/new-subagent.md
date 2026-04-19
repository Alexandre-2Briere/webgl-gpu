---
name: new-subagent
description: Define and write a new custom skill (.claude/commands/<name>.md) through a guided dialogue
invocation: /new-subagent
---

The user wants to create a new custom skill for this project. Your job is to run a focused dialogue — one round at a time — to extract all the information needed, then write the skill file automatically. Do not write the file until the spec is complete.

## Rules

1. Ask at most 3 questions per round. Pick only the unknowns that most block a complete spec.
2. Never re-ask a question the user has already answered.
3. Stay in dialogue mode until the spec is complete — no file writing, no code.
4. When the user types `done` or `enough`, stop asking and use `TBD` for any remaining unknowns.
5. The written skill file must follow the exact format of existing skills in `.claude/commands/`.
6. Never invent behavior the user did not specify — if something is unclear, mark it `TBD` and tell the user.

## Step 1 — Read existing skills for format reference

Before asking anything, silently read the following files to internalize the expected format:
- `.claude/commands/fix-vuln.md` (procedural skill example)
- `.claude/commands/brainstorm.md` (dialogue skill example)
- `.claude/commands/add-engine-util.md` (procedural skill with rules)

Do not show this to the user. Just use it to calibrate your output.

## Step 2 — Round 1: Identity

Ask the user (at most 3 questions):

1. What is the name of the skill? (kebab-case, becomes the `/command` name and the filename)
2. Describe what it does in one sentence — this becomes the `description` field and the opening line of the skill body.
3. Is this skill **procedural** (Claude executes ordered steps) or **interactive** (back-and-forth dialogue until an output is produced)?

Wait for the user's reply before continuing.

## Step 3 — Round 2: Behavior

Ask the user (at most 3 questions):

1. Are there hard **rules** this skill must always follow? (e.g. "never write files until the user confirms", "always read X first") List them or say none.
2. Should this skill **auto-trigger** when a certain condition is met — meaning Claude should invoke it proactively without the user typing the command? If yes, describe the trigger condition precisely (e.g. "when the user edits a file that imports `anthropic`").
3. Does this skill need any **specific files read upfront** before doing anything else? List paths or say none.

Wait for the user's reply before continuing.

## Step 4 — Round 3: Procedure

Ask the user (at most 3 questions):

1. Walk me through the **ordered steps** this skill should execute. Number them. Be as detailed or as high-level as you want — I will fill in the structure.
2. What does **done** look like? What should the user see or receive at the end?
3. Are there any **edge cases or failure modes** the skill should handle explicitly?

Wait for the user's reply before continuing.

## Step 5 — Confirm the spec

Once all three rounds are complete (or the user says `done`/`enough`), display the full spec for confirmation:

---
**Here is the spec for your new skill. Confirm or correct before I write the file.**

**Name:** `<name>` → invoked as `/<name>`
**Description:** <one-liner>
**Type:** procedural | interactive
**Auto-trigger:** <condition or "none">

**Rules:**
- <rule 1>
- ...

**Files read upfront:**
- <path or "none">

**Steps:**
1. <step>
2. ...

**Done looks like:** <observable output>

**Edge cases:**
- <case or "none">

---

Ask: "Does this look right? Say yes to write the file, or tell me what to change."

## Step 6 — Write the skill file

Only after the user confirms: write `.claude/commands/<name>.md` using the following template, filled with the confirmed spec.

```
---
name: <name>
description: <description>
invocation: /<name>
---

<Opening sentence restating what the skill does and in what context.>

[If auto-trigger:]
TRIGGER when: <condition>
SKIP: <inverse condition — when NOT to trigger>

## Rules

1. <rule>
2. ...

[If files are read upfront:]
## Step 1 — Read context

Read the following files before doing anything else:
- `<path>`

## Step N — <Step name>

<Step body>

...

## Step N — Confirm

<What to tell the user when done.>
```

Remove any section that has no content (e.g. no Rules section if the user said none).

## Step 7 — Confirm to the user

Tell the user:
- The file path that was written: `.claude/commands/<name>.md`
- The invocation: `/<name>`
- If an auto-trigger was defined: remind them that Claude will invoke this proactively when the condition is met
