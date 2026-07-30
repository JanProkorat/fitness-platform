---
description: How wide a single work item may reach — slice boundaries, no opportunistic breadth, parallel-agent isolation
---

# Scope Boundary Rules

A work item is scoped to whatever unit this repo organizes code around — a
feature slice, a module, a package, a service boundary. Whatever that unit is
called locally, the same principle applies: boundaries here are about that
unit, not about repos as a whole.

## Stay inside the work item's scope

A work item is scoped to the unit(s) its acceptance criteria name. Reaching
outside that — into another feature/module, into shared infrastructure, into
persistence or middleware layers — is sometimes legitimate, but it is never
incidental.

If the work item's declared `files_touched` did not anticipate the reach,
**say so in the handoff `notes`** rather than expanding quietly. A reviewer
compares the diff against `files_touched` and flags unanticipated breadth.

Cross-slice work that turns out to be structural (a new shared service, a
change to a widely-depended-on interface, a shared data shape change) is its
own work item, not a side effect of the one in flight.

## No opportunistic breadth

Working Principles §3, restated only where it is easy to violate without
noticing:

- **Don't fix warnings or lint findings you didn't cause.** A pre-existing
  backlog is tracked work, not something to clear as a drive-by — see the
  pack's own verification rules for what's currently known and accepted.
  New warnings in code you touched are yours; the backlog is not.
- **Don't reformat or restyle** files the work item didn't need to change.
- **Don't refactor adjacent code** because it looks related. Propose it
  separately.
- **Don't change dependencies** as a side effect — no package bumps or pins
  unless that is the work item.

## Schema and data-migration blast radius

A schema/data migration is frequently **not reversible by reverting a
commit** — once applied, undoing it is its own operation with its own risk.
Treat any migration-generating command as sensitive: it belongs on a repo's
`ask` list, not on the default-allow path. A work item that changes a
persisted shape must say so explicitly in its acceptance criteria; discovering
mid-implementation that a migration is needed is a signal to return to the
orchestrator, not to generate one silently.

## Parallel agents and worktree isolation

Never let two concurrent agents share one working tree. Any parallel or
delegated agent that writes code gets its **own git worktree and branch**,
and must commit before reporting done. Sharing a tree has previously caused
cross-branch commit contamination requiring git recovery.

Neither the main thread nor a subagent commits — subagents hand results back,
and the main thread stops at staged changes
(`rules/git-workflow.md#stage-explicit-paths`). This is the commit-level
counterpart to `rules/pr-workflow.md#review-gate-before-landing`, which covers
the push/PR-completion side of the same restriction.

## Session root

Gates and hooks load **only from the launch directory**. A session rooted at
a container directory above the actual repo runs with every committed gate
dormant. If you find yourself rooted above the repo and about to edit code
inside it, tell the user to re-launch from the repo root first — check this
repo's own `CLAUDE.md` for the exact directory name if one is documented.
