---
name: ship-epic
description: End-to-end orchestration of a GitHub epic — read the epic and its sub-issues, dispatch the right dev sub-agents (in parallel when safe) to worktree-isolated branches, loop each child issue through the dev → qa-tester → pr-reviewer → merge gates defined in `.claude/CLAUDE.md`, then document the shipped changes via `notion-docs`. Invoke when the user says "ship epic #N", "implement epic <URL>", "drive epic #N to green", or hands over an epic issue and expects autonomous multi-PR delivery. Orchestrator-only; sub-agents never invoke this skill themselves.
---

# ship-epic — drive a GitHub epic to merge end-to-end

This skill is the named single entry-point for the project's
epic-to-PR lifecycle. The full contract (dev/QA/review/merge gates,
label taxonomy, branch conventions, merge exclusions, notion-docs
handoff) already lives in `.claude/CLAUDE.md` — this skill does not
redefine any of it. It **sequences** those gates reliably so the same
orchestration runs the same way every time.

## When to invoke

- "Ship epic #N" / "implement epic <URL>" / "drive epic #N to green"
- The user hands over a single GitHub epic issue whose body enumerates
  child issues (the pattern from epic #16, #17, weekly-check-ins,
  Photos epic, questionnaire flow).
- You're about to orchestrate ≥2 child issues and the work will span
  more than one dev sub-agent.

## When NOT to invoke

- Single-issue work — just route directly to the owning dev sub-agent
  and run the usual gates manually. The skill is overhead for one PR.
- Ad-hoc spike with no issue backing it — use `spike/<date>-<desc>`
  per the branch conventions and skip the gates.
- The user is mid-epic and asks for one specific correction — finish
  that correction through the normal routing; don't restart the skill.

## What this skill does NOT do

- Does not merge PRs without explicit in-turn authorization. The merge
  gate in `.claude/CLAUDE.md` rule 8 still applies — the skill pauses
  at READY FOR MERGE and hands back the PR URL.
- Does not bypass the merge exclusion list. PRs touching `main`,
  `backend/**/Migrations/**`, or Mongo data-mutation scripts still
  require you to merge them manually.
- Does not write code itself — dev sub-agents do.
- Does not replace `github-issues`, `qa-tester`, or `pr-reviewer` — it
  calls them.

## Preconditions

Before running any phase below, confirm:

1. You have the **epic issue number or URL**.
2. Your local `develop` is up to date: `git fetch origin && git
   checkout develop && git pull --ff-only`. If the tree is dirty,
   stop and ask the user what to do.
3. Docker is running (required by backend Testcontainers tests) *if*
   the epic contains any `scope:backend` issue.
4. The user has declared whether they want the skill to **pause at
   each child's READY FOR MERGE** or **batch-authorize all merges at
   the end**. Default: pause per child. If unsure, ask via
   `AskUserQuestion` before Phase 1.

---

## Phase 0 — Read the epic and build the work list

Actions (orchestrator):

1. Fetch the epic via `gh issue view <N> --json
   number,title,body,labels,state` (or the URL form). Parse the body
   for child-issue references — the project convention is a checklist
   of `- [ ] #123 — title` lines or explicit `Closes #123` / `Part of
   #N` links from the children themselves.
2. Fetch each child with `gh issue view <child> --json
   number,title,labels,body,state`. Filter out already-closed children
   unless the user said "re-verify closed ones".
3. Build the work list as a plain table in the chat so the user can
   sanity-check before dispatch:

```
| # | Title | scope:* | type:* | Dev agent | Depends on |
|---|-------|---------|--------|-----------|-----------|
| 123 | Publish nutrition week | backend | feature | backend-dotnet | — |
| 124 | Consume publish event in web | web | feature | web-react | 123 |
| 125 | Mobile toast on publish | mobile | feature | mobile-expo | 123 |
```

4. Decide **parallel vs sequential** per dependency:
   - Children with no dependencies that live in **different packages**
     can run in parallel (different dev sub-agents).
   - Two children in the **same package** always run sequentially —
     one worktree, one agent, one PR at a time. Parallel `backend`
     dispatches are allowed only when each backend child has its own
     worktree AND the user explicitly opted in (they're noisier and
     share Testcontainers resources).
   - A child that `Depends on` another waits for that PR to merge into
     `develop` first.

5. Present the dispatch plan to the user (one paragraph: "I'll run
   123 alone first; once merged, fan out 124 + 125 in parallel") and
   **wait for go-ahead**. Per Working Principles §5 this is a
   plan-then-execute boundary for any epic touching >5 files.

## Phase 1 — Per-child execution loop

For each child issue the plan says to run next, execute this sub-loop.
If the plan allows parallel children, the **`Agent` calls for their
respective dev sub-agents go in a single message** so they truly run
concurrently. Each dev sub-agent is started inside its own worktree
(see "Worktree setup" below).

### 1a. Worktree setup (parallel dispatches only)

Before dispatching the dev sub-agent, create the worktree:

```bash
git worktree add .worktrees/<N>-<short> \
    -b <type>/<N>-<short-kebab> origin/develop
```

Where `<N>` is the child issue number, `<short>` is ≤20 chars of the
title slugged, and `<type>` matches the child's `type:*` label. For
serial dispatches on a freshly-merged `develop`, skip the worktree
and let the dev sub-agent branch off the main checkout.

### 1b. Dispatch the dev sub-agent

Using the `Agent` tool with the correct subagent_type from the
scope→agent map in `.claude/CLAUDE.md`:

- `scope:backend` → `backend-dotnet`
- `scope:web` → `web-react`
- `scope:mobile` → `mobile-expo`
- `scope:docs-infra` → orchestrator handles it directly

The prompt must include:

- The issue number (so the agent creates the right branch).
- The absolute worktree path if one was created (so the agent `cd`s
  there first).
- A pointer to the epic so the agent has context.
- An explicit reminder to run `regen-api` at the end if the child
  changed endpoint contracts (backend) or after pulling a backend
  merge (web / mobile).

### 1c. Gate loop: dev → qa-tester → pr-reviewer

Follow `.claude/CLAUDE.md` rules 6 and 7 literally. Summary:

1. Dev agent finishes → orchestrator dispatches `qa-tester` with the
   child issue number. Loop dev ↔ qa until `qa-tester` returns
   OVERALL ✅ PASS.
2. Orchestrator dispatches `pr-reviewer` to open/update the PR and
   run the `review` skill. Loop dev → qa → review until
   `pr-reviewer` returns OVERALL ✅ READY FOR MERGE.
3. Report the PR URL up to the chat. **Stop** for merge
   authorization per rule 8 — unless the user opted for batch
   authorization in Phase 0 (see Phase 2 below).

### 1d. Merge (per-child mode only)

If the user chose "pause at each child":

- Wait for the same-turn "merge it" from the user.
- Re-dispatch `pr-reviewer` with the authorization + merge strategy
  from the PR's `type:*` label. It handles the exclusion list.
- When `pr-reviewer` returns MERGED, run:
  ```bash
  git worktree remove .worktrees/<N>-<short>
  ```
  then sync local `develop` (the reviewer already does this, but
  double-check the tree is clean).
- Dispatch `notion-docs` (update mode) with the merged PR's SHA and
  issue number before moving to the next child.

## Phase 2 — Batched merges (optional)

If the user chose "batch-authorize at the end":

- After every child has hit READY FOR MERGE (Phase 1c complete for
  all), present one summary in chat:
  ```
  Epic #N ready to merge:
  - #123 https://github.com/.../pull/456 (type:feature, squash)
  - #124 https://github.com/.../pull/457 (type:feature, squash)
  - #125 https://github.com/.../pull/458 (type:docs, rebase — or
    BLOCKED: touches backend/Migrations/, merge manually)
  ```
- Wait for the same-turn approval. "Merge all" is valid; an
  enumerated list ("merge 123 and 124, I'll do 125 myself") is
  also valid.
- Merge the approved ones in dependency order (a child that another
  depends on goes first). After each merge, rebase the dependent
  child's PR onto the new `develop` and re-run `pr-reviewer` against
  it before merging — batch mode does not skip the post-rebase
  review, because the rebase can introduce new conflicts.
- Remove each worktree as its PR merges.
- Dispatch `notion-docs` once at the end with the full set of merged
  PRs, not per-child — batch mode's tradeoff is one aggregated doc
  entry instead of N small ones.

## Phase 3 — Close the epic

After every child that's going to merge has merged (the user may have
chosen to defer or drop one or two):

1. Comment on the epic issue with a recap: which children shipped,
   which deferred, links to merged PRs. Use `gh issue comment <epic>
   --body-file` with a HEREDOC. This is a `github-issues` task —
   dispatch it rather than running `gh` directly.
2. If all children are closed, ask the user whether to close the
   epic. Don't close it unilaterally — sometimes an epic stays open
   as a tracking issue for a follow-up.
3. Final `notion-docs` pass with the epic summary.

---

## Epic-level verification checklist (before declaring the skill done)

- [ ] Every child issue referenced by the epic was either shipped
      (merged) or explicitly deferred with the user's say-so.
- [ ] Every merged PR had `qa-tester` = PASS **and** `pr-reviewer` =
      READY FOR MERGE before merge — no skipped gates.
- [ ] Every merge used the correct strategy per `type:*` label
      (feature/bug/refactor → squash; docs/chore → rebase).
- [ ] No PR that hit the merge exclusion list was merged by the skill
      (base = `main`, `backend/**/Migrations/**`, Mongo data-mutation
      scripts) — those went back to the user.
- [ ] All `.worktrees/<N>-<short>/` directories removed.
- [ ] Local `develop` is synced and clean.
- [ ] `notion-docs` update(s) landed.
- [ ] Epic issue was either closed (with user approval) or commented
      with the final recap.

## Error-recovery notes

- **A child's gates fail repeatedly.** After 3 dev → qa loops on the
  same child with no progress, stop and surface to the user. Don't
  burn the turn budget in a tight loop; this is the signal to hand
  back or drop the child from the epic.
- **A merge fails in batch mode.** Merge whichever PRs did succeed,
  flag the failure in the Phase 3 recap, and leave the failing PR's
  branch intact for the user.
- **The user's local `develop` diverged mid-epic.** If `git pull
  --ff-only` fails between children, stop and ask — don't force
  anything. A merge commit on `develop` is the user's call, not the
  skill's.
- **Session runs out of context mid-epic.** Each child is an
  independently resumable unit: the branch is pushed, the PR is
  open, the last `qa-tester` / `pr-reviewer` verdict is in the PR
  thread. A fresh session can invoke `ship-epic` again with the
  same epic number and it will pick up from "which children haven't
  merged yet".

## Related skills to chain

- **`github-issues`** — called by Phase 3 for the epic recap comment
  and by `pr-reviewer` if labels need cleanup mid-loop.
- **`qa-tester`, `pr-reviewer`, `notion-docs`** — the three gates and
  the docs tail. `ship-epic` is the sequencer; they remain the
  authorities for their respective steps.
- **`root-cause-swarm`** — if a child's dev loop is stalling on a
  non-obvious bug (qa fails for a reason the dev agent can't
  diagnose), promote the diagnosis to a parallel swarm instead of
  guessing.
- **`engineering:standup`** — day-end recap of what the epic shipped,
  sourced from the Notion Changelog page that `notion-docs`
  maintains.

## Never

- Never merge a PR without same-turn authorization. Rule 8 is not
  overridden by the skill.
- Never let one sub-agent touch more than one package. If a child
  issue spans packages, it stays on **one branch** with sequential
  sub-agent dispatches — never fan out across packages for a single
  issue.
- Never skip a gate to save a round trip. QA and review are the
  contract; bypassing them defeats the skill's purpose.
- Never hand-edit `generated.ts`. If a child changed backend
  contracts, the web/mobile dev agent runs `regen-api` before
  touching call sites.
