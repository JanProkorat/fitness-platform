---
name: dotnet-build
description: dotnet pack's stable build-only entrypoint — the compile floor, separated from the test run so the conductor's quality gate can run a fast build before the fuller dotnet-verify pass. Common agents invoke this by name for the `dotnet` stack; never call `dotnet build` directly (common/PACK-CONTRACT.md).
argument-hint: "(no arguments — always the plain solution build)"
---

# dotnet-build

The compile/build-only check for this stack — the verification floor. A WI
declaring `verification.tool: "dotnet-build"` runs only this; a WI declaring
`"dotnet-test"` runs `dotnet-verify` instead, which invokes the same build
implicitly as part of `dotnet test`.

## Before you run anything

Read the repo's own `CLAUDE.md` for the solution file name and path — this
pack does not hardcode it. Look for the newer `.slnx` XML solution format
first; a glob for only `*.sln` silently finds nothing on a repo that has
migrated to `.slnx`.

## Command

Run from the repo root:

```bash
dotnet build <solution>
```

Plain build — **never `-warnaserror`**. `-warnaserror` can fail for reasons
that have nothing to do with the work at hand (a transitive package advisory,
a pre-existing warning backlog the repo's own `CLAUDE.md`/rules may document
as known-broken); adopting it as a gate teaches everyone to ignore a check
that can never go green. If plain build passes, the floor is satisfied.

Do not add flags that change what gets built (`--no-restore`,
`-p:TreatWarningsAsErrors=true`, etc.) unless the repo's own `CLAUDE.md`
explicitly documents them as part of its own baseline command.

## Reporting discipline

Same discipline as `dotnet-verify`
(`rules/verification-contract.md#reporting-discipline`): read the full
output, name the exact command run (including the solution file name), and
never claim a pass you didn't observe. Populate the handoff's
`verification.tool` with `dotnet-build` exactly.

## Done when

`dotnet build <solution>` ran to completion, you read its full output, and
can state pass/fail with zero errors as the bar (warnings are not a failure
here unless the repo's own rules say otherwise for code you touched).
