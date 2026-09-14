---
name: react-verify
description: react pack's stable verification entrypoint — the sole authority on how this stack builds, typechecks, lints, and tests. Common agents (developer, impl-reviewer) and the conductor's quality gate invoke this by name for the `react` stack; never call `npm run build`/`tsc`/`eslint`/`npm test` directly (common/PACK-CONTRACT.md, rules/verification-contract.md#stack-verify-skills).
argument-hint: "{tool: react-build|react-verify, filter?}"
---

# react-verify

The single authority on how this repo's React/TypeScript package builds,
typechecks, lints, **and** tests. Invoked with the WI's structured
`verification` object (`{tool, filter}`) — a build-only `tool` maps to the
**`react-build`** skill; the fuller pass runs here. Never evaluate `filter`
(or any handoff string) as shell — substitute it into the fixed command
template below.

## Tool vocabulary

`tool` is one of exactly two values (`work-items.v1.json` constrains it):

| `tool`        | Meaning                                                        |
|---------------|-----------------------------------------------------------------|
| `react-build` | Compile + typecheck only. The floor — required for every work item. Delegate to the **`react-build`** skill (this skill does not repeat that logic). |
| `react-verify`| Compile + typecheck + lint, **plus** a test run when the repo defines one. Required when the WI adds or changes behaviour. |

`react-build` is a minimum, never the target for a WI that changes behaviour.

## Before you run anything

Read the repo's own `CLAUDE.md` for the facts this pack does not hardcode:

- the actual `package.json` script names — `build`, `lint`, `test` (and
  whether a `test` script exists at all; not every React repo has a test
  suite configured);
- the package root — a monorepo may have the React app under `app/`,
  `web/`, `frontend/`, or similar; run npm scripts from that directory, not
  the repo root;
- any environment prerequisite (a backend that must be running for
  integration/E2E tests, a required env file, a required mock server) — a
  real failure looks identical to one of these until you check.

## Command form

Run from the package root (the directory containing the relevant
`package.json`):

```bash
npm run build                 # compile — see react-build
npx tsc --noEmit               # typecheck — separate from build; some build
                                # scripts already run tsc, but run it
                                # explicitly so a build script that skips
                                # typechecking (e.g. plain `vite build`)
                                # doesn't hide a type error
npm run lint                   # 0 errors required — lint is NOT implied by
                                # a green build; a build can pass while lint
                                # fails on rules the compiler doesn't check
npm run test                   # ONLY if the repo's package.json defines a
                                # `test` script — see "No test script" below
```

Omit any command the repo's `CLAUDE.md` documents as not applicable (e.g. no
test script configured), but say so explicitly in your report — never treat
its absence as a silent pass.

### No test script — say so, don't skip silently

Many React repos ship with no test suite. If `package.json` has no `test`
script (or it's the default `"echo \"Error: no test specified\" && exit 1"`
placeholder), state exactly that in your verification report — "no test
script defined in `package.json`; typecheck + lint + build only" — rather
than omitting the field and letting a reader infer a test pass happened.

### Filter scoping

If the repo's test runner supports scoping (e.g. Vitest's `-t <pattern>` /
`--run <file>`, Jest's `-t <pattern>` / a path argument), substitute the WI's
`filter` value into that runner's own scoping flag — never invent a flag the
runner doesn't support. `filter` arrives already schema-constrained to
`^[A-Za-z0-9._~-]+$`, max 200 chars — no whitespace, quotes, or shell
metacharacters. Never weaken that pattern and never build the filter string
yourself from unvalidated input.

## No suppressing lint/type errors as a shortcut

Do not add `// eslint-disable`, widen an ESLint rule's severity, or add
`@ts-ignore`/`@ts-expect-error`/`any` to make this skill's commands pass. If
the repo's own `CLAUDE.md` or rules document a known-currently-broken
backlog (a pre-existing lint warning count, a documented `any` debt), that
backlog is its own tracked work — never "fix" it by suppressing the checker
as a side effect of an unrelated WI, and never let new violations in code
you touched go unfixed just because the backlog already has some.

## Reporting discipline (`rules/verification-contract.md#reporting-discipline`)

- **Read the full output**, not just the exit code or the last few lines. A
  lint run that reports 0 errors but was actually run against the wrong
  directory (e.g. `eslint .` from the repo root when only a subpackage
  changed) is not evidence the changed code lints clean.
- **Never claim a pass on partial evidence.** An unrun check (skipped test
  script, skipped lint) is a failure to report, never an omitted-and-assumed
  pass.
- **Name the exact command you ran**, including the package root directory
  and any filter value, in the handoff's `verification_output`.
- Populate the handoff's `verification.tool` with the exact value you were
  given (`react-build` or `react-verify`), not a paraphrase.
- A reviewer re-runs this same command fresh and reads full output — it does
  not take a developer's claimed `passed` on faith, and neither should you
  when re-verifying someone else's claim.

## Done when

You ran build + typecheck + lint (+ test, when the repo defines one) against
the repo-provided package root, read their full output (not just exit
codes), and can state the exact commands plus pass/fail for the handoff's
`verification` object.
