---
name: conductor
description: Orchestrate the spec → design → implement → review → ship pipeline with user gates. Use only when explicitly invoked with /conductor.
disable-model-invocation: true
argument-hint: "<feature request or 'continue'>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Agent
  - Skill
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git log:*)
model: opus
---

# /conductor — pipeline orchestrator

You drive the spec → design → implement → review → ship pipeline by dispatching subagents via `Agent` and pausing for user approval at each gate. Every decision uses `AskUserQuestion`.

The build/test tooling is not the conductor's to name: the quality gate runs, for every adopted pack, that pack's stable-named `<stack>-build` and `<stack>-verify` skills, never a literal command (`common/PACK-CONTRACT.md`, `rules/verification-contract.md#stack-verify-skills`). This keeps `allowed-tools` above free of any stack Bash command.

## When to use

User explicitly invokes `/conductor`. Argument is the feature request or the literal `"continue"`.

## Invariants

- **You** are the only thing that writes `.claude/state/pipeline.json`. Subagents write `.claude/state/handoff-<agent>.json` only.
- **Never** proceed past a gate without explicit user confirmation.
- **Never** commit. Phase 6 prepares the branch and stages changes, then stops — the user reviews and finishes manually (`rules/pr-workflow.md#review-gate-before-landing`). Do not invoke a commit skill on their behalf.
- All rules live in `.claude/rules/*.md` and `CLAUDE.md`. Never restate.

## State file

`.claude/state/pipeline.json` validates against `.claude/schemas/pipeline-state.v1.json`. On start:

1. If exists: `jq` it. Parse fail → show raw to user, offer (a) repair, (b) reset, (c) abort.
2. If `phase != "done"`: ask "Resume at phase <X>?" — default yes.
3. Otherwise start a new run.

## Phases

### Phase 1 — Interview

Ask user to extract: id, title, actors, preconditions, main flow, acceptance criteria, out-of-scope, non-functional reqs. If an interview/grill skill is installed, invoke it for the long-form path.

Identify the domain complexity from the task description and the interview. Record as `pipeline.json.complexity_tag` (`"routine" | "moderate" | "novel"`).

Write spec to `docs/specs/todo/{seq}_{id}_{slug}.md` matching `.claude/schemas/spec.v1.json`.

**Gate A:** Normally an explicit "spec looks right?" confirmation **before** dispatching the designer. Exception: if `complexity_tag === "routine"`, **defer** Gate A and present it together with Gate B after the designer returns (see Phase 2). When asked immediately, confirming moves the spec to `docs/specs/in-progress/`, records `gates_passed: ["A"]`, and updates `pipeline.json`.

### Phase 2 — Design

Dispatch optional pack-provided design specialists **only when** `complexity_tag === "novel"` and the pack ships them. Dispatch all in a single message with multiple Agent tool calls; feed their notes to our designer.

Dispatch `designer` with the spec path. Designer writes `.claude/state/handoff-designer.json` + `docs/specs/in-progress/{slug}-work-items.md`. Single-WI result is valid for small/trivial specs.

Read the handoff, topo-sort `work_items` by `depends_on`. Cycle → fail loudly, re-dispatch designer with cycle detail.

**Gate B:** Show work-items doc. Ask "Proceed to design review?"

**Deferred Gate A (routine only):** when `complexity_tag === "routine"` AND designer emits exactly 1 WI of size ≤ S, Gate A was not asked in Phase 1. Present spec **and** work items together in a single `AskUserQuestion` now, so the user approves both at once. The user must still approve the spec — this saves one round-trip but does **not** skip the approval itself. If either is rejected, fall back to asking Gate A and Gate B separately.

### Phase 3 — Design review loop (max 3 rounds)

**Fast-path skip:** when `handoff-designer.json` has exactly 1 WI AND `estimated_complexity ∈ {XS, S}` AND no new persisted structure in `files_touched` AND `complexity_tag !== "novel"`, ask via `AskUserQuestion`: *"Looks trivial (1 WI, size {complexity}, tag {complexity_tag}). Skip design review?"* **Default = keep design-review** — user must opt in to skip.

**Contradiction guard:** if the designer's handoff contradicts `complexity_tag` — e.g. a new persisted structure added, `files_touched` crosses module folders, `estimated_complexity = L` or `XL`, or `rule_citations` include architecture anchors — **do not offer the skip**. Warn and continue to the full design-review round.

If skip is chosen, jump to Phase 4.

Otherwise: dispatch `design-reviewer`. Read `.claude/state/handoff-design-reviewer.json`. If `blocks_merge: true` → re-dispatch `designer` with findings. Stop at `blocks_merge: false` or round 3.

**Gate C:** Show review report each round. Ask "Fix and re-review / accept / stop?"

### Phase 4 — Implementation loop

For each WI in topological order:

1. Dispatch `developer` with the WI id. Read `.claude/state/handoff-developer-{wi_id}.json`.
2. If `hit_max_turns: true`: resume same WI on user confirmation.
3. Dispatch `impl-reviewer` with WI id. Read `.claude/state/handoff-impl-reviewer.json`. If `blocks_merge: true` → re-dispatch `developer` with findings. Max 3 rounds per WI.

**Gate D:** Show report after each WI iteration. Ask "Continue to next WI / redo / stop?"

**Clear boundary between WIs.** When the user chooses "Continue to next WI", before dispatching the next WI, ask via `AskUserQuestion`: *"Run `/clear` and resume from `pipeline.json`?"* Default = yes. Rationale: all state is on disk (`pipeline.json` + per-WI `handoff-*.json`); the pack/repo's `SessionStart` state-reinjection hook re-hydrates after `/clear`. Carrying every prior WI's subagent summary into the next WI's main-thread context bloats the window without adding signal — and compaction mid-WI makes gate invariants harder to re-establish. On the final WI, skip the clear and move to Phase 5. If the user declines, continue without clearing.

### Phase 5 — Quality gate

For **every stack in the repo's `CLAUDE.md` scope→stack map that has an adopted pack**, run that pack's stable-named skills — each pack owns its own concrete commands, tool vocabulary, and known-broken-gate triage (`common/PACK-CONTRACT.md`; `rules/verification-contract.md#stack-verify-skills`):

1. **`<stack>-build`** — blocking. The compile/build floor, for that stack.
2. **`<stack>-verify`** — blocking. The global test safety net for that stack: this is the full run, so any environment preconditions the pack documents (a required background service, fixtures) must be met.

Run both steps for each adopted pack before moving to Gate E — a repo with a `dotnet` pack and a `react` pack runs `dotnet-build`/`dotnet-verify` **and** `react-build`/`react-verify`. Before re-dispatching `developer` on a red result, rule out the environmental causes the failing stack's `<stack>-verify` skill documents (`rules/verification-contract.md#stack-verify-skills`); re-dispatching on an environment-down failure wastes a full WI cycle.

Read full output of every run; do not claim "passed" on partial evidence (`rules/verification-contract.md#reporting-discipline`). On build/test failure → re-dispatch `developer` with the failure output.

**Gate E:** Show quality results. Ask "Approve commit?"

### Phase 6 — Ship

**Read `rules/pr-workflow.md` and `rules/git-workflow.md` now if not already in context.** They have no `paths:` trigger that a source-file read would fire, so at this purely-orchestration moment a citation is a load instruction, not a pointer.

Prepare the branch off an up-to-date base. The base is whatever this repo was cut from — confirm it, don't assume (`rules/pr-workflow.md#pr-base-branch`); the branch name must be `feature/<TASK>-<slug>` or `bugfix/<TASK>-<slug>` with the slug present (`rules/git-workflow.md#branch-naming`). Stage the specific paths that changed — **never `git add -A`** (`rules/git-workflow.md#stage-explicit-paths`, `#never`). Then stop: do not commit, do not push, do not open a PR. The user reviews and finishes manually (`rules/pr-workflow.md#review-gate-before-landing`).

Opening/merging a PR is remote-specific — do not assume a particular CLI works; check the repo's remote and its own wiring first (`rules/pr-workflow.md#opening-a-pr-is-remote-specific`).

## Error recovery

- Subagent crashes (no handoff file) → ask user: retry / abort / edit state.
- `hit_max_turns: true` → ask: resume same WI or split it.
- Review round 3 still blocks → ask user to edit work items / spec, then return to Phase 3 or 4.
- Any adopted pack's `<stack>-build` fails after Gate D → back to Phase 4 with the failing WI.

## Don't

- Don't dispatch pack design specialists when `complexity_tag !== "novel"`.
- Don't run the design-review loop when the fast-path skip applies and the user accepts.
- Don't commit. Don't write subagent handoff files.
- Don't name a literal build/test command — run each touched stack's `<stack>-build` / `<stack>-verify`.
- Don't proceed past any gate without explicit user confirmation.

## Done when

- `pipeline.json.phase === "done"`.
- `gates_passed` includes every required gate (A may be deferred and asked alongside B for `routine`; C may be skipped via fast-path).
