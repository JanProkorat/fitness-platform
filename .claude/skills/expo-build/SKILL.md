---
name: expo-build
description: expo pack's stable build-only entrypoint — the typecheck floor, separated from the doctor/test run so the conductor's quality gate can run a fast check before the fuller expo-verify pass. Common agents invoke this by name for the `expo` stack; never call `tsc` directly (common/PACK-CONTRACT.md).
argument-hint: "(no arguments — always the plain typecheck)"
---

# expo-build

The typecheck-only check for this stack — the verification floor. A WI
declaring `verification.tool: "expo-build"` runs only this; a WI declaring
`"expo-verify"` runs the fuller `expo-verify` skill instead, which includes
this same typecheck step plus `expo-doctor` (and test, when configured).

Expo/RN apps are interpreted by Metro at dev time and by EAS/native tooling
at release time — there is no separate "compile" step comparable to a web
bundler's `build` script that this pack needs to invoke. TypeScript's own
`tsc --noEmit` is the floor: it's the fastest signal that the change is
internally type-consistent, before the heavier `expo-doctor` project-health
check runs as part of the fuller `expo-verify` pass.

## Before you run anything

Read the repo's own `CLAUDE.md` for:

- the package root (may not be the repo root — a monorepo may keep the
  Expo/RN app under `mobile/`, `app/`, or similar);
- confirmation that `tsc` is configured in strict mode for this package (a
  non-strict `tsconfig.json` changes what "typecheck clean" actually proves,
  though it does not change the command to run).

## Command

Run from the package root:

```bash
npx tsc --noEmit        # typecheck only — no emit, no bundling
```

Do not add flags that change what gets checked or silence output you'd
otherwise need to read (`--incremental` reporting only diffs across runs
without a full clean baseline first, piping through `| tail`) unless the
repo's own `CLAUDE.md` documents them as part of its own baseline command.

## Reporting discipline

Same discipline as `expo-verify`
(`rules/verification-contract.md#reporting-discipline`): read the full
output, name the exact command run (including the package root), and never
claim a pass you didn't observe. Populate the handoff's `verification.tool`
with `expo-build` exactly.

## Done when

`npx tsc --noEmit` ran to completion, you read its full output, and can
state pass/fail with zero errors as the bar.
