# Claude Code Ecosystem — Day-4 Additions

**Compiled:** 2026-05-01 (scheduled `daily-resercher` run)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)

**Scope:** Items the prior three reports did not cover. Day 4 leans into the runtime-orchestration layer — async hooks, dynamic context injection, dependency-aware orchestration, formal AC syntax — areas where the surrounding ecosystem has matured into shippable patterns rather than just docs. Six items below, ordered by fit.

> Anything previously analysed (statusline tools, OWASP skill, i18n audit, Expo MCP, Testcontainers skill, Delightful Design System, HTTP hooks, `cclint`, `claude-mem`, hosted Code Review, `dotnet-claude-kit` / Roslyn MCP, Agent Teams, `playwright-skill`, `expo-mcp`+`xc-mcp`, awesome-claude-code registries, GitHub MCP, Pact, axe-core / a11y skill, CocoIndex, Git Worktree MCP, `claude-security-guardrails`) is **not** re-covered here.

---

## 0. TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P1 | **Async hooks (`async: true`)** — Jan 2026 Claude Code 2.1+ feature | Lets us bolt telemetry / Slack notify / Notion-changelog drafts onto `gate-check.sh` (SubagentStop) without blocking the validation gate. Pure win — current gate is the slowest path on every dev-handoff. |
| P1 | **`barkain/claude-code-workflow-orchestration`** — dependency-aware parallel orchestrator | The first community plugin that codifies what `ship-epic` currently does manually: explicit dependency-analysis phase, adaptive-nudge enforcement (instead of silent contract), wave sequencing. Strong reference even if we don't adopt it wholesale. |
| P2 | **Dynamic context injection** — `` !`command` `` syntax inside skills | Replaces the bespoke SessionStart `reinject-state.sh` for several skills. A skill can run a shell command at load-time and embed the output into its own prompt — lighter, in-tree alternative to a hook. |
| P2 | **EARS / `Axiom` skill** — formal acceptance-criteria syntax | Makes AC machine-parseable for `qa-tester`. Currently the gate is prose ("✅ When client navigates to X, then Y") — formalising lets the agent generate test stubs from the AC itself. |
| P3 | **ER Flow Database Architect MCP** — live PostgreSQL schema → EF Core migrations | Replaces the manual `dotnet ef migrations add` scaffolding step in `backend-dotnet`'s migration flow. Useful when migrations are non-trivial (multi-table FK chain, partial indexes). |
| P3 | **XcodeBuildMCP v1.x LLDB tools** — breakpoints + variable inspection from the agent | Net-new since we adopted XcodeBuildMCP. Lets `qa-tester` actually debug a failing native-only AC instead of guessing from screenshots. |

---

## 1. Async hooks — non-blocking telemetry on `gate-check.sh`

**What it is:** Claude Code 2.1.0+ (rolled out late January 2026) adds an `async: true` flag on hook entries. The hook fires, but the agent does not wait for it to finish — output is discarded, no blocking, no exit-code check. The synchronous variant remains the default.

**Source:** [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) · [JP Caparas: Async hooks and when to use them](https://reading.sh/claude-code-async-hooks-what-they-are-and-when-to-use-them-61b21cd71aad)

**Where it slots in:**

`.claude/hooks/gate-check.sh` runs on every SubagentStop and JSON-validates the dev-handoff before control returns. Today it's a single synchronous step — fast in the happy path, but it owns the entire critical path between "dev sub-agent finishes" and "orchestrator can dispatch `qa-tester`."

What we'd add **alongside** (not replacing) it:

```jsonc
// .claude/settings.json
{
  "hooks": {
    "SubagentStop": [
      { "command": ".claude/hooks/gate-check.sh" },                    // sync — must block
      { "command": ".claude/hooks/log-handoff.sh", "async": true },    // async — telemetry
      { "command": ".claude/hooks/notify-slack.sh", "async": true }    // async — only when AFK
    ]
  }
}
```

`log-handoff.sh` could append a one-line JSON record per handoff to `.claude/state/handoff-log.ndjson` (sub-agent name, issue #, files-touched count, verification.passed, ms-elapsed). That's the data we currently *don't* have for analysing why a `ship-epic` run took N minutes — it'd answer "which sub-agent type is the slowest" without context cost.

`notify-slack.sh` could wrap the `ask-user-async` flow more cheaply — instead of the orchestrator explicitly invoking the skill at a blocker, the hook fires on every `qa-tester` ❌ FAIL handoff and pings #fitness-platform-dev. Off by default; flip on when the user is AFK.

**Why this project specifically:**

- The auto-memory entry `feedback_check_ci_before_merge.md` and the verification rules already produce structured signals. Logging them is currently manual.
- Notion-docs mode currently runs *after* the merge — async post-merge hooks could pre-stage a Notion draft entry as soon as `pr-reviewer` returns READY FOR MERGE, so the post-merge run is just a publish.

**Risk:** Async failures are silent. Don't async anything in the critical path (validation, permission checks). The matrix in JP Caparas's post is the rule of thumb: logging, notifications, cleanup, backups → safe; PreToolUse, security gates → must block.

**Effort:** ~30 min — one new shell script, one settings.json edit, one telemetry schema decision (where the NDJSON file lives, rotation policy).

**Fit score:** 5/5 — direct upgrade to existing infrastructure, zero risk to the validation gate.

---

## 2. `barkain/claude-code-workflow-orchestration` — dependency-aware orchestration

**What it is:** A community plugin that formalises multi-agent orchestration into three explicit phases: **task decomposition → dependency analysis → wave sequencing**. Phases that genuinely don't depend on each other run in parallel; the rest run serially. Sub-agents get adaptive-nudge feedback (silent → hint → warning → strong reminder) when they bypass the planned routing instead of being silently wrong.

**Source:** [barkain/claude-code-workflow-orchestration](https://github.com/barkain/claude-code-workflow-orchestration) · [claudefa.st: Agent Teams & Execution Modes (Q1 2026)](https://claudefa.st/blog/guide/agents/agent-teams)

**Where it slots in:**

`ship-epic` already fan-outs sub-issues in parallel, but **within** an issue (cross-package work) we go strictly sequential per [`rules/scope-boundaries.md#cross-package-coordination`](../.claude/rules/scope-boundaries.md): backend → web → mobile. That's correct when the web/mobile work needs the regenerated `generated.ts`. But it's not always required — a docs-only adjustment in `web/` and a pure-mobile token tweak don't depend on each other.

The `barkain` pattern would let `ship-epic` ask: "for issue #N, which of the touched packages have *no* shared schema dependency?" and run those sub-agents truly concurrently.

The other half — adaptive-nudge enforcement — fits a long-standing soft-spot: `pr-reviewer` enforces the boundary rule at PR time (a `backend-dotnet` PR touching `/web/**` is a BLOCKING finding), but the dev sub-agent doesn't get earlier feedback. An adaptive-nudge PreToolUse hook could intercept the first cross-boundary Edit, prompt the sub-agent to return to the orchestrator, and only escalate to a hard block if the agent ignores the nudge.

**Why this project specifically:**

- Recent epics (#67 diary-request, #65 photo feature) had cases where sequential dispatch was overkill — the cost of a stricter design analysis could have been recovered in shorter wall-clock.
- The two-tier merge model already needs a dependency graph implicitly (which sub-issues block the epic merge). Making it explicit means `ship-epic` can show the user a graph at kickoff and at sibling-rebase time.

**Risk:** Adopting the whole plugin means introducing competing orchestration logic to `ship-epic`. Better path: read the source, lift the dependency-analysis phase into a new `epic-deps` helper skill, and leave `ship-epic` in charge.

**Effort:** ~4 hours — read the plugin source, decide which patterns to lift, write a `dispatch-plan.md` artefact that `ship-epic` produces at kickoff (issue list, dependency edges, recommended waves), one round of evaluation against last week's epics.

**Fit score:** 4/5 — strong conceptual fit; bigger lift than P1 because of the integration with existing `ship-epic` state.

---

## 3. Dynamic context injection — `` !`command` `` syntax in skills

**What it is:** Skills (and slash-command markdown files) can now embed shell command output at load time. Inside SKILL.md, writing `` !`git rev-parse --short HEAD` `` causes Claude Code to execute that command before the skill content reaches the model — so the *current* git SHA is in the skill, not the SHA from when the skill was authored.

**Source:** [claudefa.st: Complete Guide to All 12 Lifecycle Events](https://claudefa.st/blog/tools/hooks/hooks-guide) · [ofox.ai: Hooks, Subagents, and Skills 2026](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/)

**Where it slots in:**

We currently have `.claude/hooks/reinject-state.sh` (SessionStart) re-hydrating `state/handoff-*.json` references after a `/clear` or compact. That's the right pattern for *cross-skill* state. But there are several places where a single skill has its own ephemeral context need:

- `regen-api` — needs to know if the dev API is currently up on `:5001`. Today the skill prose says "check if the API is running first." With dynamic injection: `` !`lsof -ti:5001 || echo none` `` — the skill *starts* knowing the answer.
- `mobile-screen` — needs the current Expo SDK version to suggest the right deprecation. `` !`jq -r .expo.sdkVersion mobile/app.json` ``.
- `mongo-document` — needs the existing collection list to avoid name collisions. `` !`docker exec mongo mongosh --quiet --eval "db.adminCommand('listDatabases').databases.map(d=>d.name).join(',')"` ``.

The point isn't to replace the SessionStart hook — that handles cross-cutting state. It's that dynamic injection is **in-tree** (lives in the skill file), so the skill is self-contained and doesn't depend on an external shell script the user might forget to wire up.

**Why this project specifically:**

- Skills like `regen-api` and `signalr-event` are most often invoked mid-session, not at session start — the SessionStart hook is the wrong layer for their state.
- Reduces total hook count: today three of the five PreToolUse / SessionStart / SubagentStop hooks exist purely to inject project state. Some of that can move into the skills themselves.

**Risk:** Shell expansion in skill content is a security surface. The skills run with the user's shell — `` !`...` `` can read arbitrary files. Not new risk for an authenticated CLI session, but be sceptical of skills installed from random plugin marketplaces.

**Effort:** ~1 hour per skill — pick three skills with clearest state needs, replace the prose check with a dynamic-injection one-liner, smoke-test, document in CLAUDE.md.

**Fit score:** 4/5 — small per-skill change, compound benefit across the skill catalogue.

---

## 4. EARS / `Axiom` — machine-parseable acceptance criteria

**What it is:** EARS (*Easy Approach to Requirements Syntax*) is a five-template grammar for acceptance criteria — every AC bullet conforms to one of: ubiquitous (`The system shall ...`), event-driven (`When <trigger>, the system shall ...`), state-driven (`While <state>, the system shall ...`), unwanted-behaviour (`If <condition>, then the system shall ...`), or optional-feature. The `Axiom` community skill builds review pipelines on top: the spec is structured, so the QA agent can match each bullet to a specific test case.

**Source:** [rohitg00/awesome-claude-code-toolkit (Axiom skill)](https://github.com/rohitg00/awesome-claude-code-toolkit)

**Where it slots in:**

`qa-tester` currently reads the issue's `## ✅ Acceptance criteria` section as prose. The handoff JSON it writes (`state/handoff-qa-<N>.json`) records pass/fail per bullet, but the matching is human-driven — the agent decides "this bullet maps to this test."

If the AC is in EARS form, that mapping becomes algorithmic:

- `When user submits the diary-request form, the banner appears on the Today screen.`
  → trigger = `submit form`; postcondition = `banner appears`; QA generates: render Today, simulate form submit, assert banner.
- `If trainer is missing, the Today screen shows the No-Trainer state instead.`
  → guard = `trainer missing`; postcondition = `No-Trainer state`; QA generates: clear trainer, render, assert state.

The flip side: `github-issues` would need to emit AC in EARS form. We'd want a `github-issues` mode that converts a draft AC list into EARS before the issue lands.

**Why this project specifically:**

- The auto-memory entry `feedback_interrogate_deferred_acs.md` exists because we've had churn around prose AC ambiguity. EARS removes the ambiguity at the source.
- `qa-tester`'s Playwright + Simulator runs already follow a setup → action → assert shape. EARS encodes exactly that.

**Risk:** Adoption cost. Issues we already wrote in prose stay in prose; EARS would only apply to new issues. Worse: a strict EARS lint at `github-issues` time would push back on humans writing the issue, which is friction even if technically right.

**Effort:** Big. ~1 day to write a `github-issues` EARS-conversion mode, ~2 hours to teach `qa-tester` to consume EARS, ongoing tax to enforce on new issues. Only worth doing if the next 3+ epics are similarly large to #67 / #65.

**Fit score:** 3/5 — strong concept, real adoption cost. Park as a follow-up; revisit after the next epic if QA churn surfaces.

---

## 5. ER Flow Database Architect MCP — live schema → migrations

**What it is:** An MCP server that connects to a live PostgreSQL instance, reads the current schema (tables, FKs, indexes, partitioning), and produces EF Core / Prisma / SQLAlchemy migrations from natural-language requests. Claims to handle multi-table FK chains, partial-index design, and migration safety analysis (ALTER TABLE on a 50M-row table flagged as unsafe).

**Source:** [ER Flow: Claude as Database Architect](https://erflow.io/en/blog/claude-mcp-database-architect)

**Where it slots in:**

`backend-dotnet`'s migration flow today: human asks for a schema change → agent edits the entity / configuration → `dotnet ef migrations add` → agent reads the generated up/down → orchestrator inspects the diff. The weak spot is *step zero* — neither the agent nor the human always knows the current schema state in detail. We rely on the entity classes being the source of truth, which is *usually* fine, but mismatches happen (especially after a manual hot-fix in a non-prod DB).

The MCP would let `backend-dotnet` start from "what's actually there right now" rather than "what the entity classes say." For a project with the merge-exclusion list rule (`backend/**/Migrations/**` is human-merged), getting the migration *correct on the first pass* is high-value — every migration round trip costs a manual merge.

**Why this project specifically:**

- We're past the easy migration phase. Recent migrations (PhotoDiaryRequest entity, plan-photos backfill) touched multiple tables and indexes. The next denormalisation pass (likely on `Conversations` / `WorkoutLogs` for read performance) will need exactly this kind of analysis.
- Combines well with the existing `mongo-document` skill — MongoDB migrations are easier (no schema), but the relational side is where surgical migrations matter.

**Risk:** The MCP needs DB credentials. Use a read-only role for schema inspection; never give it write access to production. Local dev DB is fine for development; CI/prod stays out of scope.

**Effort:** ~30 min to install + provision a read-only role on the local dev DB. Zero changes to existing skills (the MCP is invoked ad-hoc by the agent during a migration request).

**Fit score:** 3/5 — useful when migrations get complex; marginal for routine entity additions.

---

## 6. XcodeBuildMCP v1.x — LLDB tools (genuinely new)

**What it is:** XcodeBuildMCP shipped v1.0 in February 2026 with 59 tools, including a new LLDB integration: set breakpoints, step through Swift/Obj-C, inspect variables, run arbitrary LLDB commands against a running simulator app — all from the agent.

**Source:** [XcodeBuildMCP Docs](https://www.xcodebuildmcp.com/) · [getsentry/XcodeBuildMCP](https://github.com/getsentry/XcodeBuildMCP) · [blake_crosley: Two MCP Servers as iOS Build System](https://blakecrosley.com/blog/xcode-mcp-claude-code)

> Note vs prior reports: 04-29 covered XcodeBuildMCP for *autonomous testing* paired with `expo-mcp`. The angle here is different — debugging a failing AC, not running a green test path.

**Where it slots in:**

`qa-tester` today, on a native-only AC failure (MMKV state, haptics, camera, native nav transition), captures a screenshot and falls back to "ask the user." The screenshot tells you *what's wrong* but not *why*. With LLDB tools, when an AC asserts that "after dismissing the camera modal, the back-stack pops to Today," the agent can:

1. Set a breakpoint on the `popToTop` call in the navigation handler.
2. Trigger the camera flow.
3. Inspect whether the call fires at all, and with what arguments.

For a project that recently shipped per-meal photo + plan-photo gallery with native pickers, the difference between "screenshot says wrong screen" and "LLDB shows `popToTop` was called with the wrong root" is the difference between a 3-hour native-bug round-trip and a 20-minute one.

**Why this project specifically:**

- Mobile epics #65 and #67 both had native-state bugs that ended in `ui-tradeoff` skill invocations because the screenshot evidence wasn't enough to root-cause. LLDB would have shortened those to root-cause in one step.
- The `root-cause-swarm` skill explicitly looks for multi-layer bugs — LLDB gives the mobile layer the same observability the backend layer has via logs.

**Risk:** Adds a new failure mode — LLDB session can hang the simulator. Cheap to mitigate (kill simulator, restart) but worth a guardrail in `qa-tester` (cap LLDB session at 5 min, then abort and report).

**Effort:** ~1 hour to update the `qa-tester` agent description with the new LLDB tools and add a "when to use LLDB vs screenshot" decision rule. Zero install (XcodeBuildMCP is already wired in).

**Fit score:** 4/5 — already-paid integration cost, net-new capability against an existing pain point.

---

## What's NOT in this report

Surfaced in research but skipped:

- **`great_cto` skill (7-agent SDLC)** — interesting reference, but our `ship-epic` + workflow agents already cover the same shape with project-specific knowledge. Adopting `great_cto` would mean rewriting our orchestration to fit a generic template.
- **`moyu` anti-overengineering skill** — claims 66% code reduction, but the metric is unverified and the project's concern isn't over-engineering volume — it's the working-principles compliance (root-cause, scope discipline, two-attempt rule), which is human judgment, not a skill.
- **`nv:context` MCP-discovery skill** — useful for greenfield setup; we're past that phase.
- **Virtual Monorepo pattern** — single-monorepo project, doesn't apply.
- **React Native enterprise MCP** — heavy overlap with `mobile-expo`; would only add value if mobile scope expanded into bare React Native.
- **.NET MCP via NuGet 10** — only relevant if we ship custom MCPs to other consumers; not the current need.
- **Forked subagents (Feb 2026 experimental)** — explicitly experimental; the current SubagentStop + handoff schema model is more proven. Re-evaluate when stable.
- **Native Agent Teams** — same reasoning, already covered in the 04-29 report; no new movement.

---

## Suggested execution sequence (delta vs days 1–3)

If days 1–3 produce a `.claude/`-tooling cleanup PR (statusline, OWASP, i18n audit, GitHub MCP, axe-core, Worktree MCP, security guardrails), day 4 fits as a **runtime-orchestration tightening** PR:

1. **Async hooks** — add `log-handoff.sh` (NDJSON telemetry) async on SubagentStop. **Ship first** — pure additive, no risk to existing gates.
2. **XcodeBuildMCP LLDB rules** — update `qa-tester` agent description with native-debug decision rule. ~1 hour.
3. **Dynamic context injection** — pilot on `regen-api` and `mobile-screen` skills (smallest blast radius). If smooth after a week, extend to `mongo-document` and `signalr-event`.
4. **`barkain` dependency-analysis phase** — read source, propose a `dispatch-plan.md` artefact for `ship-epic`. Ship behind a flag; only flip on for the next ≥3-sub-issue epic.
5. **ER Flow MCP** — install when the next non-trivial migration lands. Don't pre-install; tools you don't use rot.
6. **EARS / `Axiom`** — defer. Revisit if the next epic shows AC-ambiguity churn.

---

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [JP Caparas — Async hooks: what they are and when to use them](https://reading.sh/claude-code-async-hooks-what-they-are-and-when-to-use-them-61b21cd71aad)
- [blake_crosley — 95 Hooks: Why They Exist](https://blakecrosley.com/blog/claude-code-hooks)
- [claudefa.st — Complete Guide to All 12 Lifecycle Events](https://claudefa.st/blog/tools/hooks/hooks-guide)
- [claudefa.st — Agent Teams & Execution Modes (Q1 2026)](https://claudefa.st/blog/guide/agents/agent-teams)
- [ofox.ai — Hooks, Subagents, and Skills (2026 Guide)](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/)
- [smartscope — Claude Code Hooks Guide (March 2026 edition)](https://smartscope.blog/en/generative-ai/claude/claude-code-hooks-guide/)
- [barkain/claude-code-workflow-orchestration](https://github.com/barkain/claude-code-workflow-orchestration)
- [rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit)
- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [Owen Zanzal — The Virtual Monorepo Pattern](https://medium.com/devops-ai/the-virtual-monorepo-pattern-how-i-gave-claude-code-full-system-context-across-35-repos-43b310c97db8)
- [ER Flow — Claude as Database Architect](https://erflow.io/en/blog/claude-mcp-database-architect)
- [XcodeBuildMCP Docs](https://www.xcodebuildmcp.com/)
- [getsentry/XcodeBuildMCP](https://github.com/getsentry/XcodeBuildMCP)
- [blake_crosley — Two MCP Servers as iOS Build System](https://blakecrosley.com/blog/xcode-mcp-claude-code)
- [Shipyard — Multi-agent Orchestration for Claude Code](https://shipyard.build/blog/claude-code-multi-agent/)
- [MindStudio — 5 Claude Code Workflow Patterns](https://www.mindstudio.io/blog/claude-code-agentic-workflow-patterns)
