---
name: fix-vuln
description: Fix a vulnerability and remove it from Vuln.md at the project root
invocation: /fix-vuln
---

The user wants to fix one or more vulnerabilities and remove them from `Vuln.md`.

## Arguments

The user will provide one or more vulnerability IDs after the command, e.g.:

```
/fix-vuln VULN-01
/fix-vuln VULN-02 VULN-04
```

If no ID is provided, ask the user which vulnerability they want to fix.

## Step 1 — Read the current Vuln.md

Read `Vuln.md` at the project root in full so you have the current content and can identify the entry/entries for the given ID(s).

## Step 2 — Read and fix the code

For each matched entry:

1. Find the `**File:**` line — it contains the file path and approximate line numbers of the vulnerable code.
2. Read that file to understand the current implementation.
3. Apply the fix described in the entry's **Fix:** section. Make the actual code edit now, before touching `Vuln.md`.

## Step 3 — Ask the user to confirm the fix

Show the user what was changed and ask them to confirm the fix looks correct before proceeding to remove the Vuln.md entry.

## Step 4 — Remove the entry from Vuln.md

Only after the user confirms the fix: edit `Vuln.md` to delete the identified section(s), including:
- The `---` separator **above** the heading
- The heading line itself (`## VULN-XX · ...`)
- All body lines up to (but not including) the next `---` separator

Keep the rest of the file intact. Ensure no double blank lines or orphaned `---` separators remain.

## Step 5 — Confirm

Tell the user which ID(s) were removed and how many vulnerabilities remain open in the file.
