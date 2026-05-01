---
name: ship-epic
description: GitHub epic orchestration via epic-branch model — design-review + dispatch children off epic, auto-merge children, open epic PR, same-turn auth merge, notion-docs. Invoke on "ship epic #N". Orchestrator-only.
disable-model-invocation: true
argument-hint: "<epic-issue-number-or-URL>"
---

# ship-epic — drive a GitHub epic to merge end-to-end

This skill is the named single entry-point for the project's
epic-to-PR lifecycle. The full contract (dev/QA/review/merge gates,
label taxonomy, branch conventions, merge exclusions, notion-docs
handoff) already lives in `.claude/CLAUDE.md` — this skill does not
redefine any of it. It **sequences** those gates reliably so the same
orchestration runs the same way every time.

The skill follows the project's **epic-branch model** (see
`.claude/CLAUDE.md` → "Epic-branch model"):

```
develop                                ← only the consolidated epic merges in
 └── feature/<epic-N>-<short>          ← the epic branch (created in Phase 0)
      ├── feature/<C1>-<short>         ← sub-issue branches (Phase 1)
      ├── fix/<C2>-<short>             ← merge into the epic branch automatically
      └── refactor/<C3>-<short>           after dev → qa → review (rule 8a)
```

Sub-issue PRs merge into the **epic branch**, not `develop`. Only
when every child has landed on the epic branch does the skill open one
consolidated PR against `develop` and pause for explicit same-turn
user authorization (rule 8b). This is what the user means by "I don't
want a half-shipped epic on develop".

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
   stop and ask the user what to do. The epic branch (Phase 0) will
   be created off this fresh `develop`.
3. Docker is running (required by backend Testcontainers tests) *if*
   the epic contains any `scope:backend` issue.

Note: there is no longer a "pause at each child / batch-authorize at
the end" choice. The epic-branch model is the single mode — sub-issue
PRs auto-merge into the epic branch, and authorization is required
only once, at the epic merge to `develop` (Phase 3).

## State persistence (survives `/clear` and compact)

Every phase boundary writes `.claude/state/ship-epic.json` so the
orchestration can resume after a context reset. The
`reinject-state.sh` SessionStart hook reads this file on every fresh
session and surfaces it back as context.

**Write the state file at every transition:**

- After Phase 0 step 4 (epic branch created + pushed): `phase: "creating"`.
- Just before each child dispatch in Phase 1: append/update that
  child's entry with `status: "in-progress"`, current `branch`,
  current `pr` (null until opened).
- After each child merge: bump that entry to `status: "merged"`.
- When opening the epic PR (Phase 2): `phase: "epic-pr"` and capture
  the epic PR number on a new top-level field if useful.
- After the epic merge (Phase 2b): `phase: "done"`, then move on to
  Phase 3.

**Schema:** [`schemas/ship-epic-state.v1.json`](../../schemas/ship-epic-state.v1.json)
— validated by `reinject-state.sh` on every SessionStart. Required
fields: `epic_number`, `epic_branch`, `phase` (`creating |
design-reviewing | dispatching | merging-children | epic-pr | done`),
`children` array (each `{ issue, status, branch?, pr?, depends_on?,
estimated_complexity?, blocked_reason? }`), `started_at`, `updated_at`
(ISO-8601). Optional `fast_path: bool` and `epic_pr: int` once those
phases are reached. Every state-file write must include the literal
`"$schema": ".claude/schemas/ship-epic-state.v1.json"` field — that's
how the validator finds the schema.

**On session start with a non-empty state file**: the reinject hook
emits the current epic + children. If `phase != "done"`, the
orchestrator picks up where it left off — usually by re-running the
loop body for the first child whose `status != "merged"`.

---

## Phase 0 — Read the epic, build the work list, and create the epic branch

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
   - A child that `Depends on` another waits for that PR to **merge
     into the epic branch** first (no longer "into `develop`" — under
     the epic-branch model, dependent siblings observe each other on
     the epic branch).

5. Present the dispatch plan to the user (one paragraph: "I'll run
   123 alone first; once merged into the epic branch, fan out 124 +
   125 in parallel; epic branch goes to develop at the end") and
   **wait for go-ahead**. Per Working Principles §5 this is a
   plan-then-execute boundary for any epic touching >5 files.

6. Create and push the **epic branch** off the latest `develop`:

```bash
git fetch origin
git checkout develop
git pull --ff-only

EPIC_N=<N>                              # e.g. 66
EPIC_SHORT=<kebab>                      # ≤20 chars from the epic title
EPIC_BRANCH="feature/${EPIC_N}-${EPIC_SHORT}"

git checkout -b "$EPIC_BRANCH" develop
git push -u origin "$EPIC_BRANCH"
git checkout develop                    # leave the main checkout on develop
```

The epic branch is empty at this point — no commits beyond
`develop`'s tip. Sub-issue worktrees will branch off it. Record
`$EPIC_BRANCH` for the rest of the skill — every `--base`, every
worktree, every dev-agent brief uses it.

Optional but recommended: post a comment on the epic issue noting the
branch (`gh issue comment <N> --body "Epic branch:
\`feature/${EPIC_N}-${EPIC_SHORT}\`. Sub-issues will merge here, not
into develop."`). Route via `github-issues` rather than running `gh`
directly.

## Phase 0a — Dependency resolution (topo-sort + cycle detection)

After Phase 0 builds the child list and BEFORE the fast-path check
(0b) runs, resolve any explicit cross-child dependencies declared in
the issue bodies.

### How children declare dependencies

Each child issue body MAY contain a "Depends on #N" or
"**Depends on:** #N, #M" line — the `github-issues` agent supports
this syntax in issue templates. Parse those out into a
`depends_on: [int]` array on each child entry.

### Topological sort

Sort children so each comes after every issue it depends on. Standard
Kahn's algorithm works fine — pick a child with no remaining open
deps, schedule it, remove it from the dep list of its dependents,
repeat. Ties (multiple ready-now children) preserve their original
issue-order so the user sees a stable plan.

### Cycle detection

If after topo-sort there are still children with unresolved deps, you
have a cycle. **Fail loudly** — emit the cycle path
(`#A → #B → #A`) and surface it via `AskUserQuestion`. Do NOT
dispatch any of the cycle's members. The user fixes the issue
metadata (drops one of the dependencies), then ship-epic re-runs
Phase 0a.

### Effect on dispatch

After topo-sort + cycle detection passes:

- Children with **no remaining deps** are eligible for parallel
  dispatch in Phase 1 (and the fast-path check in 0b).
- Children with deps are held until all their deps reach
  `status: merged` in `state/ship-epic.json`. The ship-epic loop
  re-checks eligibility after each child merge.
- Persist `depends_on` to each child entry in the state file so
  re-injected sessions know the dependency graph.

### Why an explicit declaration

Implicit dependencies (e.g. "child B touches a file child A creates")
are not detected here — that's the design-reviewer's job (Phase 1b
contradiction guard). This phase only handles dependencies the user
explicitly declared in the issue body. Unstated deps that surface
only at design-review time pull the affected child out of the
fast-path; the rest of the epic continues.

## Phase 0b — Fast-path eligibility check (deferred-gate)

After Phase 0 creates the epic branch and BEFORE the per-child loop
runs, check if the epic qualifies for the deferred-gate fast-path.
The default flow runs design-review per child with separate user
visibility per round; the fast-path consolidates that into ONE
approval prompt covering "epic plan + all child design-reviews" so
small routine epics don't burn N+1 user touchpoints.

### Trigger conditions — ALL must hold

1. **Size bound:** the epic has either a single child, OR ≤3 sibling
   children whose `approved_scope.files_in_scope` are **disjoint**
   (no pair overlaps).
2. **Per-child complexity:** every child's
   `approved_scope.estimated_complexity` is in `{XS, S}`.
3. **No new entity:** no child's `files_in_scope` contains a path
   under `backend/.../Domain/Entities/` or
   `backend/.../Domain/Documents/`. New aggregates always need full
   per-child user visibility.
4. **AC quality:** every child issue body has ≥3 concrete AC bullets
   (well-specified — `github-issues` enforces this on creation, but
   re-verify here).
5. **Scope-label match:** every child's `scope:*` label matches the
   orchestrator's intended dispatch. No orchestrator-side scope
   guesses (a guess is a soft signal that the issue is under-defined).

### Contradiction guard

Before offering the fast-path, scan each child's design-review
findings (if any have already run). If ANY child has:

- A new `DbSet` or aggregate added.
- `files_in_scope` crossing package boundary (`backend` + `web` in
  same child).
- `estimated_complexity` ≥ M.
- `rule_citations` including architecture anchors
  (`rules/code-quality.md#no-re-layered-services`, etc.).

→ **Suppress the fast-path offer**. Require per-child approvals.
The cost of this guard is small; the cost of an architectural
decision flying past unreviewed is not.

### Fast-path action

Instead of asking the user for separate approvals (epic plan → child
1 design review → child 2 design review → ...), present ONE
consolidated `AskUserQuestion`:

> "Epic plan + design-review summary for all N children. Approve to
> dispatch all in parallel."

Include in the question body:
- The epic title and number.
- Each child: number, title, sub-agent, `estimated_complexity`,
  `files_in_scope` summary, `error_paths` count.
- A note that any individual child can later self-eject from the
  fast-path if its design-review actually returns NEEDS-REVISION.

On approval, dispatch ALL children's design-review + dev pipelines
**concurrently** (each in its own worktree per
[`rules/branch-and-pr.md#parallel-sub-agents-one-branch-each`](../../rules/branch-and-pr.md#parallel-sub-agents-one-branch-each)).

### Fall-back

Any child whose design-review returns NEEDS-REVISION or BLOCK pulls
itself out of the fast-path:

- The orchestrator surfaces that single child's issue to the user.
- The other children continue without interruption.
- When the user resolves the blocked child, ship-epic resumes its
  per-child loop for that one child only.

### When the fast-path is rejected

If any of the trigger conditions fails, fall through to the regular
Phase 1 loop (one design-review per child, default user visibility).
This is the safe default — never auto-promote ambiguous epics.

## Phase 1 — Per-child execution loop (sub-issue → epic branch)

For each child issue the plan says to run next, execute this sub-loop.
If the plan allows parallel children, the **`Agent` calls for their
respective dev sub-agents go in a single message** so they truly run
concurrently. Each dev sub-agent is started inside its own worktree
(see "Worktree setup" below). **Every sub-issue branch is rooted off
`origin/$EPIC_BRANCH`, never `origin/develop`.**

### 1a. Worktree setup (parallel dispatches only)

Before dispatching the dev sub-agent, create the worktree off the epic
branch. **Prefer the `git-worktree` MCP** (registered in `.mcp.json`)
over raw shell — it returns structured paths/branch names, surfaces
errors as MCP responses instead of stderr the orchestrator has to
parse, and avoids path-escaping bugs on slugged titles. Call its
worktree-create tool with:

- `path`: `.worktrees/<N>-<short>` (relative to repo root)
- `branch`: `<type>/<N>-<short-kebab>` (new branch — the child's)
- `commit` / `base`: `origin/$EPIC_BRANCH`

Where `<N>` is the child issue number, `<short>` is ≤20 chars of the
title slugged, and `<type>` matches the child's `type:*` label.

If the MCP isn't reachable in the current session (e.g. running
ship-epic from an environment without the `git-worktree` server), fall
back to:

```bash
git fetch origin "$EPIC_BRANCH"
git worktree add .worktrees/<N>-<short> \
    -b <type>/<N>-<short-kebab> "origin/$EPIC_BRANCH"
```

For serial dispatches on a freshly-merged epic branch, skip the
worktree entirely and let the dev sub-agent branch off the main
checkout — but make sure the main checkout is on `$EPIC_BRANCH` first
(`git checkout $EPIC_BRANCH && git pull --ff-only`).

### 1b. Run design-review (Rule 5.5)

**Before dispatching the dev sub-agent**, invoke `design-reviewer`
with the child issue + dispatch brief (target sub-agent, base branch
= `$EPIC_BRANCH`, scope summary, guessed `files_in_scope`). Read the
result at `.claude/state/handoff-design-<N>.json`:

- **APPROVE** → proceed to 1c. Pass `approved_scope` forward — the
  dev sub-agent reads it as its first action.
- **NEEDS-REVISION** → tighten the brief per the findings, re-submit.
  Loop up to 3 rounds total. Round 4 → escalate to user, mark this
  child as blocked in `state/ship-epic.json`, continue with siblings.
- **BLOCK** → surface `blocked_reason` to user. Common: AC ambiguity
  → route to `github-issues` to clarify; missing parent epic branch
  → can't happen here since you created it in Phase 0.

If a child design-reviews to BLOCK while siblings are mid-flight,
let the siblings continue (the BLOCKED child pulls itself out of the
fast-path; ship-epic resumes when the user resolves the block).

### 1c. Dispatch the dev sub-agent

Using the `Agent` tool with the correct subagent_type from the
scope→agent map in `.claude/CLAUDE.md`:

- `scope:backend` → `backend-dotnet`
- `scope:web` → `web-react`
- `scope:mobile` → `mobile-expo`
- `scope:docs-infra` → orchestrator handles it directly

The prompt must include:

- The issue number (so the agent creates the right branch).
- The **base branch the agent should root from** — `$EPIC_BRANCH`,
  spelled out explicitly. Tell the agent this is a sub-issue of
  epic #`$EPIC_N` and that the PR will target the epic branch, NOT
  `develop`. Without this nudge an agent that hasn't read the latest
  CLAUDE.md will default to `develop`.
- The absolute worktree path if one was created (so the agent `cd`s
  there first).
- A pointer to the epic so the agent has context.
- An explicit reminder to run `regen-api` at the end if the child
  changed endpoint contracts (backend) or after pulling a backend
  sub-issue merge (web / mobile).

### 1c. Gate loop: dev → qa-tester → pr-reviewer

Follow `.claude/CLAUDE.md` rules 6 and 7 literally. Summary:

1. Dev agent finishes → orchestrator dispatches `qa-tester` with the
   child issue number. Loop dev ↔ qa until `qa-tester` returns
   OVERALL ✅ PASS.
2. Orchestrator dispatches `pr-reviewer` to open/update the PR and
   run the `review` skill. **Pass `base: $EPIC_BRANCH` explicitly** in
   the dispatch — that's how `pr-reviewer` knows to open the PR
   against the epic branch and (later) treat the merge as a
   sub-issue auto-merge.
3. Loop dev → qa → review until `pr-reviewer` returns OVERALL ✅
   READY FOR MERGE.
4. **Do NOT pause for the user.** Proceed straight to 1d.

### 1d. Auto-merge into the epic branch

Sub-issue PRs auto-merge per rule 8a — no per-PR user pause.

- Re-dispatch `pr-reviewer` in `mode: merge-sub-issue` with the PR
  number. It runs the pre-merge CI gate, the merge exclusion check,
  and then `gh pr merge <n> <strategy> --delete-branch` against the
  epic branch.
- If `pr-reviewer` returns BLOCKED (CI red, or the diff hits the
  merge exclusion list), surface the BLOCKED reason to the user. For
  CI failures route the fix to the owning dev sub-agent and re-run
  `qa-tester` → `pr-reviewer` (review pass) → `pr-reviewer` (merge
  pass). For exclusion BLOCKED (migrations, Mongo data scripts), the
  user merges that one PR by hand onto the epic branch and tells you
  to continue.
- When `pr-reviewer` returns MERGED, remove the worktree. **Prefer
  the `git-worktree` MCP's worktree-remove tool** with `path:
  .worktrees/<N>-<short>`. Fallback when the MCP isn't reachable:
  ```bash
  git worktree remove .worktrees/<N>-<short>
  ```
- **Rebase any in-flight sibling sub-issue branches onto the new
  epic-branch tip.** If a sibling is mid-task in a worktree, post a
  note to its dev sub-agent ("epic branch advanced — rebase before
  next push") rather than rebasing under it. If a sibling already has
  an open PR but hasn't been re-reviewed yet, run:
  ```bash
  git -C .worktrees/<sibling>/ fetch origin "$EPIC_BRANCH"
  git -C .worktrees/<sibling>/ rebase "origin/$EPIC_BRANCH"
  git -C .worktrees/<sibling>/ push --force-with-lease
  ```
  then re-dispatch `qa-tester` and `pr-reviewer` against the rebased
  sibling before its own auto-merge fires. (Force-with-lease, never
  force.)
- **Do NOT dispatch `notion-docs`** for sub-issue merges. That fires
  exactly once, in Phase 3, after the epic merges to `develop`.

Move on to the next child issue.

## Phase 2 — Open and review the epic PR (epic branch → develop)

Once every sub-issue the user wants in the epic has merged into the
epic branch (or been deferred with their say-so):

1. Confirm the epic branch is clean and ahead of `develop`:
   ```bash
   git fetch origin
   git log --oneline "origin/develop..origin/$EPIC_BRANCH"
   ```
   If the log is empty, the epic landed nothing — abort and ask the
   user what happened. If `develop` has moved while the epic was
   open, rebase the epic branch onto the new `develop` tip:
   ```bash
   git checkout "$EPIC_BRANCH"
   git pull --ff-only
   git rebase origin/develop      # or git merge origin/develop, user's call
   git push --force-with-lease
   ```
   Resolve conflicts the same way you'd resolve any rebase. Don't
   force-push to `develop` itself ever.

2. Open the **epic PR** with `pr-reviewer`. Dispatch in
   `mode: open-and-review` with:
   - `branch: $EPIC_BRANCH` (the head)
   - `base: develop`
   - issue number = the **epic** issue number (so the PR body links
     `Fixes #<epic-N>` and GitHub auto-closes the epic on merge).
   - Hand it the list of sub-issue numbers that landed; `pr-reviewer`
     will compose a body that links `Fixes #<child>` for each, so
     **GitHub auto-closes every sub-issue on the epic merge** in one
     atomic transaction.

3. `pr-reviewer` runs the same two-pass review on the consolidated
   diff (`git diff origin/develop...origin/$EPIC_BRANCH`). The
   sub-reviewer reads it cold — it has not seen the per-sub-issue PRs
   that already shipped to the epic branch. That's intentional: the
   epic PR is the unit that lands on `develop`, and a fresh-eyes pass
   on the union of changes is exactly the gate `develop` deserves.

4. If verdict is 🔁 NEEDS REWORK, route the scope-tagged fix list to
   the owning dev sub-agent. The fix lands on a **new sub-issue
   branch off the epic branch** — opened, reviewed, and auto-merged
   per Phase 1 — never directly on the epic branch. Then re-dispatch
   `pr-reviewer` against the same epic PR (mode: re-review).

5. When `pr-reviewer` returns ✅ READY FOR MERGE on the epic PR,
   present the URL to the user with a one-paragraph summary of what
   the epic ships:
   ```
   Epic #<N> is ready to merge to develop:
     PR: <url>
     Sub-issues consolidated: #<C1>, #<C2>, …
     Strategy on merge: --squash (one commit per epic on develop)
   Reply "merge it" / "go ahead" / "approved, merge" to ship; reply
   "I'll merge this one myself" to defer to manual.
   ```
   Then **wait** for the same-turn authorization phrase. Historical
   approval from earlier in the conversation does not count
   (rule 8b).

## Phase 2b — Merge the epic PR to `develop`

When the user authorizes:

1. Re-dispatch `pr-reviewer` in `mode: merge` with the PR number and
   the verbatim authorization phrase.
2. `pr-reviewer` runs the pre-merge CI gate, the merge exclusion
   check, and then `gh pr merge <n> <strategy> --delete-branch` —
   `--squash --delete-branch` for `type:feature` (the typical epic
   shape). The squash collapses every sub-issue commit into a
   single commit on `develop` named for the epic; `develop` history
   stays linear and one revert undoes the whole epic.
3. If `pr-reviewer` returns BLOCKED on exclusions (rare for an epic,
   but possible — e.g. an EF Core migration squashed into the diff),
   tell the user and let them merge manually. Once they confirm the
   merge landed, continue to Phase 3.
4. When MERGED:
   - The remote epic branch is gone (deleted by `--delete-branch`).
   - `pr-reviewer` synced local `develop`. Sanity-check it ran clean
     (no ⚠️ local-sync warning), and clean up the local epic branch:
     ```bash
     git branch -D "$EPIC_BRANCH" 2>/dev/null || true
     ```
   - Confirm all sub-issues auto-closed: `gh issue view <child>
     --json state` for each child should now show `CLOSED`.

## Phase 3 — Recap, document, close

After the epic PR has merged to `develop` (or the user merged it
manually for an excluded epic):

1. Comment on the epic issue with a recap: which children shipped in
   the consolidated commit, which were deferred, link to the
   single merged epic PR (and the squashed commit SHA on `develop`).
   Use `gh issue comment <epic> --body-file` with a HEREDOC. This is
   a `github-issues` task — dispatch it rather than running `gh`
   directly.
2. The epic issue itself usually auto-closed via `Fixes #<epic-N>` in
   the PR body. If not, ask the user whether to close it manually —
   sometimes an epic stays open as a tracking issue for a follow-up.
3. **Single `notion-docs` pass** for the entire epic. Brief it with
   the epic number, the merged commit SHA, the list of sub-issues
   that landed, and the squashed-PR summary. This is the only
   `notion-docs` invocation in the whole skill — sub-issue merges
   onto the epic branch were intentionally not documented (they're
   intermediate; the consolidated commit is what matters).

---

## Epic-level verification checklist (before declaring the skill done)

- [ ] Every child issue referenced by the epic was either shipped
      (auto-merged into the epic branch and then included in the epic
      PR) or explicitly deferred with the user's say-so.
- [ ] Every sub-issue PR had `qa-tester` = PASS **and** `pr-reviewer`
      = READY FOR MERGE before its auto-merge — no skipped gates.
- [ ] The epic PR itself had its own `qa-tester` skip (no AC at the
      epic level — the children's ACs already passed) and a fresh
      `pr-reviewer` two-pass review on the consolidated diff before
      it was authorized for merge.
- [ ] Every sub-issue merge into the epic branch used the correct
      strategy per `type:*` label (feature/bug/refactor → squash;
      docs/chore → rebase).
- [ ] The epic PR merged to `develop` with `--squash --delete-branch`
      so the develop history shows one commit per epic.
- [ ] No PR that hit the merge exclusion list was merged by the skill
      at either tier (base = `main`, `backend/**/Migrations/**`,
      Mongo data-mutation scripts) — those went back to the user.
- [ ] All `.worktrees/<N>-<short>/` directories removed.
- [ ] Local `develop` is synced and clean. Local epic branch deleted.
- [ ] **Exactly one** `notion-docs` update landed for the entire
      epic — at the end, after the epic merged to `develop`.
- [ ] Epic issue was auto-closed via `Fixes #<epic-N>` (or commented
      with the final recap if the user opted not to close).

## Error-recovery notes

- **A child's gates fail repeatedly.** After 3 dev → qa loops on the
  same child with no progress, stop and surface to the user. Don't
  burn the turn budget in a tight loop; this is the signal to hand
  back or drop the child from the epic. The epic branch holds the
  rest of the work safely while you decide.
- **A sub-issue auto-merge fails CI.** `pr-reviewer` returns BLOCKED
  with the failing job name and a root-cause hypothesis. Route the
  fix to the owning dev sub-agent on the same sub-issue branch, let
  CI re-run, and re-dispatch `pr-reviewer` (mode: merge-sub-issue).
  Develop is unaffected — only the epic branch is at stake. A second
  CI failure on the same sub-issue still warrants surfacing to the
  user before looping silently.
- **The epic PR conflicts with `develop` at the end.** `develop`
  moved while the epic was open. Rebase the epic branch onto the new
  `develop` (force-with-lease), re-push, re-dispatch `pr-reviewer`
  (mode: re-review). Conflicts here mean the same code path was
  touched on `develop` and on the epic branch — resolve carefully,
  and consider whether anything on the epic branch needs adjustment
  in light of the develop change.
- **The user's local `develop` diverged mid-epic.** If `git pull
  --ff-only` fails between children or after the epic merge, stop
  and ask — don't force anything. A merge commit on `develop` is the
  user's call, not the skill's.
- **Session runs out of context mid-epic.** Each sub-issue is an
  independently resumable unit: its branch is pushed, its PR (if any)
  is open against the epic branch, the last `qa-tester` /
  `pr-reviewer` verdict is in the PR thread, and the epic branch
  holds the merged work. A fresh session can invoke `ship-epic`
  again with the same epic number; the skill picks up by reading
  the epic branch's git log to see which children have already
  merged and which still need to ship.

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

- Never merge the **epic PR** (base = `develop`) without same-turn
  authorization. That's the gate that protects `develop`. Rule 8b is
  not overridden by the skill. Sub-issue PRs (base = epic branch)
  *do* auto-merge — that's rule 8a — but the epic PR never does.
- Never base a sub-issue branch directly off `develop`. They must
  branch off the epic branch so the epic PR captures the full
  consolidated diff. A sub-issue branch rooted on `develop` will fail
  `pr-reviewer`'s preflight and be bounced back.
- Never merge a sub-issue PR directly into `develop`. The epic-branch
  model exists specifically so this doesn't happen. If you find
  yourself about to do it, stop — that breaks the user's stated
  pain point ("don't want a half-shipped epic on develop").
- Never let one sub-agent touch more than one package. If a child
  issue spans packages, it stays on **one branch** with sequential
  sub-agent dispatches — never fan out across packages for a single
  issue.
- Never skip a gate to save a round trip. QA and review are the
  contract; bypassing them defeats the skill's purpose.
- Never invoke `notion-docs` per sub-issue merge. The single
  invocation lives at Phase 3, after the epic ships to `develop`.
  N small docs entries for one epic is the failure mode this
  skill explicitly avoids.
- Never hand-edit `generated.ts`. If a child changed backend
  contracts, the web/mobile dev agent runs `regen-api` before
  touching call sites.
