---
name: expo-verify
description: expo pack's stable verification entrypoint — the sole authority on how this stack typechecks, doctors, and tests. Common agents (developer, impl-reviewer) and the conductor's quality gate invoke this by name for the `expo` stack; never call `tsc`/`expo-doctor`/`npm test` directly (common/PACK-CONTRACT.md, rules/verification-contract.md#stack-verify-skills).
argument-hint: "{tool: expo-build|expo-verify, filter?}"
---

# expo-verify

The single authority on how this repo's React Native / Expo package
typechecks, doctors, **and** tests. Invoked with the WI's structured
`verification` object (`{tool, filter}`) — a build-only `tool` maps to the
**`expo-build`** skill; the fuller pass runs here. Never evaluate `filter`
(or any handoff string) as shell — substitute it into the fixed command
template below.

## Tool vocabulary

`tool` is one of exactly two values (`work-items.v1.json` constrains it):

| `tool`       | Meaning                                                          |
|--------------|--------------------------------------------------------------------|
| `expo-build` | Typecheck only. The floor — required for every work item. Delegate to the **`expo-build`** skill (this skill does not repeat that logic). |
| `expo-verify`| Typecheck **plus** `expo-doctor`, **plus** a test run when the repo defines one. Required when the WI adds or changes behaviour. |

`expo-build` is a minimum, never the target for a WI that changes behaviour.

## Before you run anything

Read the repo's own `CLAUDE.md` for the facts this pack does not hardcode:

- the actual `package.json` script names — `test` (and whether a `test`
  script exists at all; not every Expo repo has a test suite configured);
- the package root — a monorepo may have the Expo/RN app under `mobile/`,
  `app/`, or the repo root — run npm/npx scripts from that directory, not
  blindly from the repo root;
- any environment prerequisite (a running Metro bundler port, a required
  `.env`/`app.config.*` value, a native prebuild step) — a real failure
  looks identical to one of these until you check.

## Command form

Run from the package root (the directory containing the relevant
`package.json`/`app.json`/`app.config.*`):

```bash
npx tsc --noEmit                # typecheck — see expo-build
npx expo-doctor                 # validates the Expo/RN project setup —
                                 # dependency version mismatches, native
                                 # config drift, unmet peer deps. A build
                                 # can look fine in tsc while expo-doctor
                                 # flags a config issue that only surfaces
                                 # at prebuild/EAS-build time.
npm run test                    # ONLY if the repo's package.json defines a
                                 # `test` script — see "No test script" below
```

Omit any command the repo's `CLAUDE.md` documents as not applicable (e.g. no
test script configured), but say so explicitly in your report — never treat
its absence as a silent pass.

### No test script — say so, don't skip silently

Many Expo/RN repos ship with no automated test suite (component tests are
comparatively rare in this stack). If `package.json` has no `test` script
(or it's a placeholder), state exactly that in your verification report —
"no test script defined in `package.json`; typecheck + expo-doctor only" —
rather than omitting the field and letting a reader infer a test pass
happened.

### Filter scoping

If the repo's test runner supports scoping (e.g. Jest's `-t <pattern>` / a
path argument), substitute the WI's `filter` value into that runner's own
scoping flag — never invent a flag the runner doesn't support. `filter`
arrives already schema-constrained to `^[A-Za-z0-9._~-]+$`, max 200 chars —
no whitespace, quotes, or shell metacharacters. Never weaken that pattern and
never build the filter string yourself from unvalidated input.

## `expo-doctor` warnings are not automatically blocking

`expo-doctor` sometimes flags advisory items (a newer SDK patch available, an
unlisted-but-compatible third-party package) that are pre-existing repo state
rather than something the current WI introduced. Read the full output and
distinguish: a warning that predates the WI and is documented as known in the
repo's own `CLAUDE.md`/rules is not this WI's to fix; a new failure the WI's
changes introduced (a genuinely incompatible dependency bump, a broken native
config) is blocking. Never suppress `expo-doctor` output or skip the command
to dodge a pre-existing warning — report it, don't hide it.

## No suppressing type errors as a shortcut

Do not add `@ts-ignore`/`@ts-expect-error`/`any` to make this skill's
commands pass. If the repo's own `CLAUDE.md` or rules document a
known-currently-broken backlog (a pre-existing `any` debt), that backlog is
its own tracked work — never "fix" it by suppressing the checker as a side
effect of an unrelated WI, and never let new violations in code you touched
go unfixed just because the backlog already has some.

## Reporting discipline (`rules/verification-contract.md#reporting-discipline`)

- **Read the full output**, not just the exit code or the last few lines. A
  test run that reports 0 failures but was actually run against the wrong
  directory (e.g. from the repo root when only the mobile package changed)
  is not evidence the changed code passes.
- **Never claim a pass on partial evidence.** An unrun check (skipped test
  script, skipped `expo-doctor`) is a failure to report, never an
  omitted-and-assumed pass.
- **Name the exact command you ran**, including the package root directory
  and any filter value, in the handoff's `verification_output`.
- Populate the handoff's `verification.tool` with the exact value you were
  given (`expo-build` or `expo-verify`), not a paraphrase.
- A reviewer re-runs this same command fresh and reads full output — it does
  not take a developer's claimed `passed` on faith, and neither should you
  when re-verifying someone else's claim.

## Done when

You ran typecheck + `expo-doctor` (+ test, when the repo defines one) against
the repo-provided package root, read their full output (not just exit
codes), and can state the exact commands plus pass/fail for the handoff's
`verification` object.
