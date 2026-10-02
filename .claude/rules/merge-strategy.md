# Rules: Merge strategy & gate

The merge gate has two sub-rules depending on the PR's base branch.
`pr-reviewer` **clears** the merge — CI on the exact head, base current,
exclusion list, stacked PRs, strategy — and hands back a pinned
`gh pr merge … --match-head-commit <sha>` command. The **main thread
runs it**: `deny-subagent-merge.py` blocks `gh pr merge` and `git push`
for every subagent, by design. Dev agents never merge.

## Strategy mapping

Strategy is chosen from the PR's `type:*` label:

- `type:feature` / `type:bug` / `type:refactor` → `--squash`
  (one atomic commit per PR; clean, revertible).
- `type:docs` / `type:chore` → `--rebase`
  (preserves the granular commits; history stays meaningful for small
  surgical changes).

Both strategies use `--delete-branch` to clean up after the merge.

For epic PRs `--squash` means **the entire epic lands as a single
commit on `develop`** — clean revert, clean changelog.

No `type:*` label or conflicting labels → abort, return BLOCKED, route
label cleanup to `github-issues` before retrying.

## Sub-issue auto-merge

When `pr-reviewer` returns ✅ READY FOR MERGE on a PR whose base is an
**epic branch** (not `develop`, not `main`):

- The orchestrator does **not** wait for per-PR user authorization.
  The whole point of the epic-branch model is that intermediate work
  lands on the epic branch invisibly to `develop` — burdening the user
  with N approvals for N sub-issues defeats the consolidation. The
  user authorizes the epic merge once at the end.
- **Pre-merge CI gate still applies.** `gh pr checks <N>` must show
  every required check as `pass`. CI failures route to the owning dev
  sub-agent (backend/web/mobile). Pending checks are polled every
  ~30s up to 10 min, then escalated.
- The merge exclusion list still applies absolutely — see
  [#exclusion-list](#exclusion-list).
- Strategy from the `type:*` label, same mapping as above.
- After the merge, the orchestrator fast-forwards the local epic branch
  (`git pull --ff-only`, never a hard reset), deletes the sub-issue
  branch best-effort, tears down its compose harness, removes its
  worktree, and rebases any in-flight sibling sub-issue branches onto
  the fresh epic-branch tip.
- **Close the sub-issue by hand** via `github-issues`. `Fixes #<N>`
  only fires on merges into the default branch, never into an epic
  branch.
- `notion-docs` is **not** dispatched per sub-issue. It runs once
  after the epic ships to `develop`.

## Authorized merge

When `pr-reviewer` returns ✅ READY FOR MERGE on a PR whose base is
`develop` (epic-level PR with `head = <epic-branch>`, or a standalone
issue's PR), the orchestrator reports the PR URL and **waits for
explicit same-turn merge authorization** — a phrase like "merge it",
"go ahead", "approved, merge". Historical approval from earlier in the
conversation does not count.

When authorized:

### Pre-merge CI gate

`gh pr checks <N>` must show every required check as `pass`. If any
check is `fail` or still `pending`, the orchestrator does NOT proceed
to merge:

- **`fail`:** read the failing job's log (`gh run view <id> --log`),
  diagnose the root cause, route the fix to the owning dev sub-agent.
  After the fix is pushed, CI re-runs automatically; orchestrator
  waits for green before merging. The user's earlier authorization
  carries through a single fix cycle. A second CI failure on the same
  PR warrants surfacing back to the user for judgment.
- **`pending`:** wait. Poll with `gh pr checks <N>` every ~30s up to
  10 min before escalating. Never merge on an unresolved status.
- **`pass`:** continue.

### Merge dispatch

1. Orchestrator re-dispatches `pr-reviewer` in `mode: merge` with the
   explicit authorization phrase.
2. `pr-reviewer` checks the [#exclusion-list](#exclusion-list). If the
   PR hits any exclusion, it returns BLOCKED with the reason — the
   user merges those manually.
3. Otherwise it confirms CI on the exact head, that the base hasn't
   moved under the green run, and that no PRs are stacked on the
   branch, picks the strategy from the `type:*` label (see top of
   file), and returns CLEARED TO MERGE with the command
   `gh pr merge <n> <strategy> --delete-branch --match-head-commit <sha>`.
4. The **main thread** runs that command, confirms the merge landed
   (`gh pr view <n> --json state,mergeCommit`), fast-forwards the
   local base (`git pull --ff-only`, never a hard reset), deletes the
   local branch best-effort and removes the worktree. A failed
   fast-forward (dirty tree, local commits) is a ⚠️ warning to the
   user, not a rollback — the merge already landed.
5. Orchestrator dispatches `notion-docs` (update mode) to document
   the change. For an epic merge the docs entry covers all the
   sub-issues that landed in the consolidated commit — not one per
   sub-issue.

## Exclusion list

The agent never merges these — user does it manually:

- PRs whose base branch is `main` (any release into the main line).
- PRs whose diff touches `backend/**/Migrations/**` (EF Core
  migrations — schema or data). Applies at both tiers — sub-issue
  PRs touching migrations also stay human-merged onto the epic
  branch.
- PRs that add or modify MongoDB data-mutation scripts (bulk fix-ups,
  seed overrides, reprocessing jobs under `backend/**/Scripts/` or
  `backend/**/DataMigrations/`, or `db.*.update`/`bulkWrite`/
  `deleteMany` calls in MongoContext / Services). Same — both tiers.
- PRs that add or modify a **one-shot data-mutation command**: any routine
  dispatched from the CLI or from startup that writes, renames, drops or
  bulk-modifies stored data, in either database, wherever the file sits. This
  bullet is deliberately phrased by what the code *does*, because the two
  bullets above are phrased by directory and by method name — and a command
  registered in `backend/**/Infrastructure/Cli/**` matches neither while being
  exactly as destructive. Two already exist:
  `RunDropLegacyTrainingCollectionsAsync` (#847) drops two collections, and
  the rename command in #1033 moves a third. Same — both tiers.
- Any PR where the user has said in the current turn "I'll merge this
  one myself".

## Skip-merge-gate scenarios

Skip this gate only if no PR was produced (doc-only commits pushed
directly, out-of-band infra tweaks). The agent never merges to
`develop` or `main` without a fresh, in-turn go-ahead.
