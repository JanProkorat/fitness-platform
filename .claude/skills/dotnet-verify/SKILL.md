---
name: dotnet-verify
description: dotnet pack's stable verification entrypoint — the sole authority on how this stack builds and tests. Common agents (developer, impl-reviewer) and the conductor's quality gate invoke this by name for the `dotnet` stack; never call `dotnet test`/`dotnet build` directly (common/PACK-CONTRACT.md, rules/verification-contract.md#stack-verify-skills).
argument-hint: "{tool: dotnet-build|dotnet-test, filter?}"
---

# dotnet-verify

The single authority on how this repo's .NET solution builds **and** tests.
Invoked with the WI's structured `verification` object (`{tool, filter}`) — a
build-only `tool` maps to the **`dotnet-build`** skill; a test `tool` runs
here. Never evaluate `filter` (or any handoff string) as shell — substitute
it into the fixed command template below.

## Tool vocabulary

`tool` is one of exactly two values (`work-items.v1.json` constrains it):

| `tool`         | Meaning                                                    |
|----------------|-------------------------------------------------------------|
| `dotnet-build` | Compilation only. The floor — required for every work item. Delegate to the **`dotnet-build`** skill (this skill does not repeat that logic). |
| `dotnet-test`  | Compilation **plus** a scoped test run. Required when the WI adds or changes behaviour. |

`dotnet-build` is a minimum, never the target for a WI that changes
behaviour.

## Before you run anything

Read the repo's own `CLAUDE.md` for the facts this pack does not hardcode:

- the solution file name and path (e.g. the repo's `*.slnx` — newer XML
  solution format; a glob for only `*.sln` finds nothing on such repos);
- the test project path(s) — a repo commonly has more than one (a fast
  unit-test project and a slower integration project that needs a background
  service such as Docker/Testcontainers). Always name the test project you
  ran; never run bare `dotnet test` from the repo root when the repo has
  multiple test projects — that pulls in every project, including slow ones,
  when the WI only needed one.
- any environment prerequisite the repo's `CLAUDE.md` or rules document (a
  required background service, a required auth claim, a required fixture
  shape) — a real failure looks identical to one of these until you check.

## Command form

Run from the repo root.

```bash
dotnet build <solution>                                     # floor — see dotnet-build
dotnet test <test-project>                                  # tool: dotnet-test, no filter
dotnet test <test-project> --filter "FullyQualifiedName~<filter>"   # tool: dotnet-test, with filter
```

Omit `--filter` entirely when the WI's `verification` has no `filter` key.
`filter` arrives already schema-constrained to `^[A-Za-z0-9._~-]+$`, max 200
chars — no whitespace, quotes, or shell metacharacters. Never weaken that
pattern and never build the filter string yourself from unvalidated input.

### The filter form is load-bearing — read this before scoping a run

This is VSTest syntax (`xunit.v3` + `xunit.runner.visualstudio` without
Microsoft.Testing.Platform runs under VSTest on most repos — confirm which
your repo's test project uses if unsure):

```bash
dotnet test <test-project> --filter "FullyQualifiedName~<filter>"
```

**Never use the MTP form `-- --filter-class <name>`.** The `--` separator
forwards arguments to Microsoft.Testing.Platform; under VSTest that argument
is silently discarded, and the run executes the **entire suite** while still
reporting a clean "Passed!" summary. The filter has no effect while the
result looks like a successful scoped run — a work item claiming "verified
class X" then carries evidence of an unrelated full-suite pass. A wrong
`FullyQualifiedName~` fragment instead fails loudly (`No test matches the
given testcase filter`), which is exactly why it is the required form: a
mistake in the filter is visible, never silent.

## No `-warnaserror`, ever

Do not add `-warnaserror` to any build or test invocation this skill runs,
and do not treat a failure under `-warnaserror` (if someone else ran it) as a
defect in the work just done. Plain `dotnet build`/`dotnet test` is the gate
for this pack. If the repo's own `CLAUDE.md` or rules document a
known-currently-broken advisory/warning backlog (a transitive package
advisory, a pre-existing `CS****` count), that backlog is its own tracked
work — never "fix" it by adding `NoWarn`/`WarningsNotAsErrors` or bumping a
package as a side effect of an unrelated WI, and never let new warnings in
code you touched go unfixed just because nothing blocks on them yet.

## Reporting discipline (`rules/verification-contract.md#reporting-discipline`)

- **Read the full output**, not just the exit code or the last few lines. A
  scoped run that silently fell back to the whole suite is not evidence the
  scoped thing works.
- **Never claim a pass on partial evidence.** An unrun check is a failure to
  report, never an omitted-and-assumed pass.
- **Name the exact command you ran**, including the test project and any
  `--filter` value, in the handoff's `verification_output`.
- Populate the handoff's `verification.tool` with the exact value you were
  given (`dotnet-build` or `dotnet-test`), not a paraphrase.
- A reviewer re-runs this same command fresh and reads full output — it does
  not take a developer's claimed `passed` on faith, and neither should you
  when re-verifying someone else's claim.

## Done when

You ran the command above against the repo-provided solution/test-project
names, read its full output (not just the exit code), and can state the exact
command plus pass/fail for the handoff's `verification` object.
