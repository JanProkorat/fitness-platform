---
name: react-build
description: react pack's stable build-only entrypoint — the compile+typecheck floor, separated from lint/test so the conductor's quality gate can run a fast check before the fuller react-verify pass. Common agents invoke this by name for the `react` stack; never call `npm run build`/`tsc` directly (common/PACK-CONTRACT.md).
argument-hint: "(no arguments — always the plain build + typecheck)"
---

# react-build

The compile/typecheck-only check for this stack — the verification floor. A
WI declaring `verification.tool: "react-build"` runs only this; a WI
declaring `"react-verify"` runs the fuller `react-verify` skill instead,
which includes this same build+typecheck step plus lint (and test, when
configured).

## Before you run anything

Read the repo's own `CLAUDE.md` for:

- the package root (may not be the repo root in a monorepo);
- the exact `build` script name in `package.json` — this pack does not
  hardcode it beyond the conventional `npm run build`.

## Command

Run from the package root:

```bash
npm run build          # e.g. `tsc -b && vite build`, or `next build`, or
                        # whatever the repo's own build script does
npx tsc --noEmit        # explicit typecheck — do not skip this even if the
                        # build script above already type-checks as a side
                        # effect; some build tooling (plain `vite build`,
                        # `esbuild`) transpiles without ever invoking `tsc`,
                        # and a build passing while types are broken is the
                        # exact trap this second command exists to catch
```

Do not add flags that change what gets built or silence output you'd
otherwise need to read (`--silent`, piping through `| tail`) unless the
repo's own `CLAUDE.md` documents them as part of its own baseline command.

## Reporting discipline

Same discipline as `react-verify`
(`rules/verification-contract.md#reporting-discipline`): read the full
output, name the exact commands run (including the package root), and never
claim a pass you didn't observe. Populate the handoff's `verification.tool`
with `react-build` exactly.

## Done when

Both `npm run build` and `npx tsc --noEmit` ran to completion, you read
their full output, and can state pass/fail with zero errors as the bar.
