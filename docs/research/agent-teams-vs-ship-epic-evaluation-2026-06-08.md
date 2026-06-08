# Evaluation: Claude Code Agent Teams vs. the `ship-epic` orchestrator pattern

**Issue:** [#193](https://github.com/JanProkorat/fitness-platform/issues/193) — *Evaluate Agent Teams native multi-agent* (sub-issue of [#173](https://github.com/JanProkorat/fitness-platform/issues/173) — *[Epic] Claude Code ecosystem additions — rollout*)
**Date:** 2026-06-08
**Type:** focused evaluation + decision record (not a `daily-researcher` digest)
**Author:** orchestrator (Claude Code)

---

## TL;DR — Decision: **Partial adopt**

**Retain `ship-epic`'s orchestrator-dispatch pattern as the production epic
lifecycle — do _not_ migrate it to Agent Teams.** Agent Teams is a real
capability that solves inter-agent communication subagents can't, but its
current limitations (no in-process resumption, no nested teams, one team per
session, ~7× token cost, experimental) are disqualifying for our
deterministic, resumable, gated, deeply-nested orchestration.

Adopt Agent Teams in a **narrow, flag-gated pilot** for two non-lifecycle use
cases where direct inter-agent messaging genuinely adds value and
resumability/cost matter less:

1. **Parallel multi-lens code review** (fresh-eyes reviewer panels).
2. **Competing-hypotheses debugging** (the `root-cause-swarm` use case).

Re-evaluate full `ship-epic` migration **at GA**, gated on the four blockers in
[§7](#7-re-evaluation-triggers).

---

## 1. What shipped

Claude Code's **Agent Teams** feature landed in **v2.1.32+**, **experimental
and disabled by default**. Enable via:

```jsonc
// settings.json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
// or: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

It provides first-class multi-agent coordination:

- **Separate full sessions per teammate** — each teammate is an independent
  Claude Code instance with **its own context window** (not an in-process
  subagent sharing the lead's context).
- **Shared task list** at `~/.claude/tasks/{team}/` — distributed to all
  teammates, file-locked; teammates self-claim unblocked tasks; dependencies
  expressible between tasks.
- **Mailbox messaging** — direct teammate↔teammate and lead↔teammate messages,
  auto-delivered (no polling). N-way, not hub-and-spoke.
- **Team config** at `~/.claude/teams/{team}/config.json` (auto-managed —
  do not hand-edit).
- **Display modes:** *in-process* (default, any terminal, cycle with
  Shift+Down) or *split-pane* (tmux/iTerm2 only). Display mode does not change
  isolation or cost.

Sources: [Agent Teams docs](https://code.claude.com/docs/en/agent-teams.md),
[Subagents docs](https://code.claude.com/docs/en/sub-agents.md),
[Costs docs](https://code.claude.com/docs/en/costs.md),
[Changelog](https://code.claude.com/docs/en/changelog.md).

## 2. What `ship-epic` is today

`ship-epic` (`.claude/skills/ship-epic/SKILL.md`) is an **orchestrator-dispatch**
pattern, not a peer-collaboration one:

- **Hub-and-spoke.** One orchestrator (main thread) spawns specialist
  sub-agents via the `Agent` tool (`backend-dotnet`, `web-react`,
  `mobile-expo`, `design-reviewer`, `qa-tester`, `pr-reviewer`) and receives
  **only their final text** (or schema-validated handoff JSON). Verbose
  intermediate output stays isolated in the sub-agent's context.
- **Deterministic gates.** A fixed sequence per child: design-review →
  dev → `qa-tester` (AC gate) → `pr-reviewer` (two-pass review) → auto-merge
  into the epic branch. The epic branch consolidates; only the squashed epic
  PR reaches `develop`.
- **Resumable across `/clear` / compact.** State persists to
  `.claude/state/ship-epic.json` (schema-validated) plus per-step
  `state/handoff-*.json`; the `reinject-state.sh` SessionStart hook
  re-hydrates context. A fresh session resumes by reading the epic branch's
  git log + the state file.
- **Deeply nested.** `pr-reviewer` itself dispatches a *blind fresh-eyes
  sub-reviewer* via `Agent` (pass 2). `root-cause-swarm` fans out parallel
  hypothesis agents. The dispatch tree is ≥2 levels deep in normal operation.
- **Sequential-by-default with bounded parallelism.** Same-package children
  run serially; disjoint-package children may fan out, each in its own
  `git worktree`. Cross-package single issues stay on one branch, sequential.
- **Bounded error recovery.** 3-loop caps on dev↔qa and design-review rounds,
  explicit escalation to the user, CI gate before any merge.

## 3. Axis-by-axis comparison

### 3.1 Latency

| | `ship-epic` orchestrator-dispatch | Agent Teams |
|---|---|---|
| Parallelism | Bounded — disjoint-package children fan out; same-package serial by design | N-way concurrent teammates |
| Coordination round-trips | Every result funnels back through the orchestrator before the next dispatch (extra hop) | Teammates message peers directly — fewer relay hops for collaborative work |
| Critical path | Gate sequence (design→dev→qa→review→merge) is intentionally serial per child | Shorter for independent parallel work; **task-status lag** can stall dependent tasks (documented limitation) |
| Net | Higher latency *by design* — the gates are the product. Predictable. | Lower latency for **independent** parallel work; unpredictable when task-status lag blocks dependents |

**Read:** Agent Teams wins raw wall-clock on independent fan-out. But
`ship-epic`'s latency is dominated by *deliberate* serial gates (QA, review,
CI), not by orchestrator relay overhead — so the theoretical speed-up is small
for our actual workload, and the task-status-lag failure mode trades
determinism for it.

### 3.2 Token cost

| | `ship-epic` | Agent Teams |
|---|---|---|
| Context model | Sub-agents return **only final text/handoff JSON**; verbose output discarded; orchestrator context stays lean | Each teammate holds its **own full context window** for the team's lifetime |
| Documented overhead | Handoff JSON + state files are small | **~7× a single session** when teammates run in plan mode; CLAUDE.md/MCP/skills reload into every teammate; idle teammates keep consuming |
| Scaling | Linear in *work*, not in *agents* (results summarized away) | **Linear in team size × active duration** |
| Net | Markedly cheaper — the summarize-back design is a token-efficiency feature | Markedly more expensive |

**Read:** This is the decisive axis given our explicit token-frugality policy
(5h window + weekly quota, shared across Claude.ai + Claude Code). A 7×
multiplier on the orchestration layer we run constantly is not affordable.
`ship-epic`'s "return only the conclusion, not the file dumps" is precisely the
context-hygiene rule the project already enforces.

### 3.3 Error recovery & reliability

| | `ship-epic` | Agent Teams |
|---|---|---|
| Resumption | **Clean** — handoff JSON + `ship-epic.json` + `reinject-state.sh`; survives `/clear`, compact, session restart | **Broken for in-process teammates** — `/resume` / `/rewind` do not restore them; lead may message ghosts. Workaround: respawn fresh |
| Supervision / restart | Orchestrator detects failure, re-dispatches, 3-loop cap, user escalation | **Not documented** — hung/crashed teammates do not auto-restart; lead must notice and replace manually |
| Nesting | Required and routine (`pr-reviewer` → blind sub-reviewer; `root-cause-swarm`) | **Forbidden** — "no nested teams"; teammates cannot spawn teams |
| Concurrency limit | Unlimited sub-agents over the epic's life | **One team per session**; must tear down before starting another |
| State integrity | Schema-validated handoffs (`gate-check.sh`); CI gate pre-merge | Task-status lag can leave dependents blocked silently |
| Maturity | Project-proven across many epics | Experimental; no GA timeline; explicit instability warnings |

**Read:** Reliability is where migration fails hardest. Two limitations are
individually disqualifying for `ship-epic`:

- **No in-process resumption** breaks the single most valuable property of our
  orchestration — surviving `/clear`/compact mid-epic. We rely on this; it's
  encoded in the state-persistence design and the `reinject-state.sh` hook.
- **No nested teams** is structurally incompatible: `pr-reviewer`'s second-pass
  blind reviewer and `root-cause-swarm`'s fan-out are *nested* dispatches. (We
  already hit the subagent-can't-spawn-agents wall once — documented in project
  memory — and solved it by having the orchestrator drive pass 2. Agent Teams
  bakes that limitation in as "no nested teams".)

## 4. Architecture fit

| Property our workflow needs | `ship-epic` | Agent Teams |
|---|---|---|
| Deterministic, repeatable gate sequence | ✅ | ⚠️ emergent / self-organizing |
| Resumable across context resets | ✅ | ❌ (in-process) |
| Token-frugal (summarize-back) | ✅ | ❌ (~7×) |
| Nested dispatch (review-of-review, swarms) | ✅ | ❌ forbidden |
| Sequential cross-package on one branch | ✅ | ⚠️ teams bias toward parallel |
| Unlimited agents over a long-running epic | ✅ | ❌ one team/session |
| Direct peer-to-peer agent messaging | ❌ (hub-and-spoke) | ✅ |
| Workers challenging each other live | ❌ | ✅ |

The two cells where Agent Teams wins (peer messaging, live mutual challenge)
are exactly the capabilities `ship-epic` does **not** need — its value is
*determinism and isolation*, not *collaboration*.

## 5. Where Agent Teams _does_ fit (the pilot)

The wins are real for **exploratory, collaborative, short-lived** work where
cost is acceptable and resumption isn't the point:

1. **Parallel multi-lens code review.** A panel of reviewers each taking a
   distinct lens (correctness / security / perf / repro), messaging each other
   to deduplicate and challenge findings, before the orchestrator consolidates.
   Adds value over today's blind-second-pass because reviewers can *converge*.
2. **Competing-hypotheses debugging** (the `root-cause-swarm` use case).
   Independent investigators that argue toward a ranked hypothesis — the
   documented "competing hypotheses, debate structure" sweet spot.

Both are **bounded, sandboxed, flag-gated**, run outside the epic lifecycle,
and don't depend on resumption or nesting.

## 6. Decision

**Partial adopt** (in the AC's trichotomy of *migrate ship-epic / partial
adopt / wontfix*):

- **`ship-epic`: do NOT migrate.** Retain orchestrator-dispatch. It is
  cheaper, resumable, deterministic, nest-capable, and proven. Migrating would
  lose all four and cost ~7× for a small, conditional latency gain.
- **Pilot Agent Teams** behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for the
  two §5 use cases only — opt-in, never on the critical path of an epic merge.
- **No rules/CLAUDE.md changes** to the orchestration source-of-truth at this
  time. The pilot is ad-hoc until GA.

## 7. Re-evaluation triggers

Revisit full `ship-epic` migration when **all** of the following are resolved
(or Anthropic announces GA, whichever first):

1. **In-process teammate resumption** works across `/resume` / `/rewind`.
2. **Nested teams** (a teammate spawning its own sub-team) are supported — or
   an equivalent that covers review-of-review and swarms.
3. **One-team-per-session** limit is lifted.
4. A **token-cost** profile materially better than the documented ~7× plan-mode
   multiplier (e.g. summarize-back / context-sharing for teammates).

Until then this decision stands. The `daily-researcher` skill should flag any
Agent Teams changelog entry touching the four items above as a trigger to
reopen this evaluation.

---

## Appendix: sources

- Agent Teams — https://code.claude.com/docs/en/agent-teams.md
- Subagents — https://code.claude.com/docs/en/sub-agents.md
- Costs (Agent Team token costs) — https://code.claude.com/docs/en/costs.md
- Changelog — https://code.claude.com/docs/en/changelog.md
- `ship-epic` skill — `.claude/skills/ship-epic/SKILL.md`
- Epic-branch model — `.claude/rules/epic-branch.md`
- Project token-frugality policy — root `CLAUDE.md` §6, global `~/.claude/CLAUDE.md`
