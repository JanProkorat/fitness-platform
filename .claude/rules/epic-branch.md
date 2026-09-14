# Rules: Epic-branch model

Epics — issues that enumerate sub-issues in their body — do **not**
ship their children one-by-one into `develop`. They ship as one
consolidated unit. This protects `develop` from a half-shipped epic
state where one sub-issue has merged and the next is still in flight.

## Branch hierarchy

```
main
 └── develop                   ← release-stable; only complete epics merge in
      └── <type>/<E>-<short>   ← THE EPIC BRANCH (one per epic issue;
                                  <type> from the epic's own type: label)
           ├── feature/<C1>-<short>   ← sub-issue branches off the EPIC branch
           ├── fix/<C2>-<short>
           └── refactor/<C3>-<short>
```

## Definitions

- **Epic issue** — a GitHub issue whose body contains a checklist of
  child-issue references (`- [ ] #123 — title`) OR child issues that
  back-reference it via "Part of #N" / "Parent: #N". Detection: any
  parent issue with ≥1 sub-issue.
- **Epic branch** — `<type>/<epic-N>-<short-kebab>`, where `<type>`
  matches the epic issue's own `type:*` label exactly as
  [`branch-and-pr.md`](branch-and-pr.md) prescribes — a refactor epic is
  `refactor/<N>-<slug>`, not `feature/<N>-<slug>`. Branched off
  `develop`. Created the moment epic work starts. Lives until the
  epic's consolidated PR merges to `develop`.

  This file previously said `feature/` unconditionally, and the
  `pull_request.branches` filters in `.github/workflows/` matched it —
  `'feature/*'` alone. Those filters were widened in #936 to cover every
  prefix above, defensively: a sub-issue PR's base is the epic branch, so
  a filter that lists only `feature/*` cannot be relied on to match a
  `refactor/` or `fix/` epic. If you add a new branch prefix, widen those
  five filters with it.

  Not a verified root cause: PR #965 had no workflow runs at creation but
  did get them on its next push, with the old filters still in place both
  times. Whatever caused that gap, it was not conclusively the prefix
  list. Treat "no checks on a fresh sub-issue PR" as unexplained, and
  push a commit before concluding CI is broken.
- **Sub-issue branch** — `<type>/<child-N>-<short-kebab>` where
  `<type>` matches the child's `type:*` label. Branched off the
  **epic branch**, not `develop`. PR base = the epic branch.
- **Standalone issue** — an issue with no parent epic. Continues to
  branch off `develop` directly with PR base = `develop`. The
  epic-branch model does not apply.

## Branch & merge flow

1. **Epic kickoff:** orchestrator creates and pushes the epic branch
   off the latest `develop`. No code yet — just a tracking branch.
2. **Sub-issue dispatch:** each sub-issue is dispatched to its dev
   sub-agent. The dev agent creates its branch off the epic branch
   (not `develop`). Concurrent sub-issues use `git worktree` rooted
   at `.worktrees/<child-N>-<short>/` based on
   `origin/<epic-branch>` — see [`branch-and-pr.md#parallel-sub-agents-one-branch-each`](branch-and-pr.md#parallel-sub-agents-one-branch-each).
3. **Sub-issue PR:** opens against the **epic branch**. `qa-tester`
   runs per the AC gate. `pr-reviewer` runs per the code-review gate.
   On READY FOR MERGE, the sub-issue PR **auto-merges into the epic
   branch** without per-PR user authorization — see
   [`merge-strategy.md#sub-issue-auto-merge`](merge-strategy.md#sub-issue-auto-merge).
4. **Sibling rebase:** after a sub-issue merges to the epic branch,
   the orchestrator rebases any in-flight sibling sub-issue branches
   onto the new epic-branch tip before letting their PRs proceed.
   Otherwise the diffs go stale.
5. **Epic PR:** when every sub-issue the user wants in the epic has
   merged into the epic branch, the orchestrator opens an **epic PR**
   with `head = <epic-branch>`, `base = develop`. `pr-reviewer` runs
   another two-pass review on that consolidated diff. The orchestrator
   presents the epic PR URL to the user and **waits for explicit
   same-turn merge authorization** — see
   [`merge-strategy.md#authorized-merge`](merge-strategy.md#authorized-merge).
6. **Epic merge:** once the user authorizes, the epic PR merges to
   `develop` (squash by default — one commit per epic on the develop
   history) and the epic branch is deleted.

## When the model applies

- The user invokes `ship-epic` (the named entry point that enumerates
  sub-issues and dispatches in parallel).
- The user hands over an epic issue ad-hoc ("implement #66") and the
  orchestrator detects sub-issues in the body or via parent
  back-references.
- The user hands over a single sub-issue ("implement #142") and the
  orchestrator detects a parent epic via the issue's body
  ("Part of #66"). The orchestrator first checks whether the epic
  branch exists; if not, it creates one off `develop` and only then
  dispatches the sub-issue against it.

## When the model does NOT apply

- Standalone issues with no parent epic — branch off `develop`,
  PR base = `develop`,
  [`merge-strategy.md#authorized-merge`](merge-strategy.md#authorized-merge) applies.
- Ad-hoc spikes (`spike/<date>-<desc>`) — no PR, no gates.
- Doc-only / chore tweaks the user explicitly wants merged one-shot to
  `develop`.
