# Claude Code Ecosystem — Day-5 Additions

**Compiled:** 2026-05-05 (scheduled `daily-resercher` run)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)
- [`claude-code-ecosystem-additions-2026-05-01.md`](./claude-code-ecosystem-additions-2026-05-01.md)

**Scope:** Items the prior four reports did not cover. Day 5 leans into Anthropic's first-party `plugins/` directory in the `anthropics/claude-code` repo — a quiet shift in late April where several patterns we built bespoke (hook authoring, plugin scaffolding, autonomous loops, structured feature workflow) now ship as official plugins. Plus two community registries that are large enough to mine for individual agents rather than adopt wholesale. Seven items below, ordered by fit.

> Anything previously analysed (statusline tools, OWASP skill, i18n audit, Expo MCP, Testcontainers skill, Delightful Design System, HTTP hooks, `cclint`, `claude-mem`, hosted Code Review, `dotnet-claude-kit` / Roslyn MCP, Agent Teams, `playwright-skill`, `expo-mcp`+`xc-mcp`, awesome-claude-code registries, GitHub MCP, Pact, axe-core / a11y skill, CocoIndex, Git Worktree MCP, `claude-security-guardrails`, async hooks, `barkain/claude-code-workflow-orchestration`, dynamic context injection `` !`cmd` ``, EARS / Axiom, ER Flow Database Architect, XcodeBuildMCP LLDB) is **not** re-covered here.

---

## 0. TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P1 | **Anthropic first-party `feature-dev` plugin** — 7-phase explore→architect→implement→test→refactor→review→ship | Codifies what `ship-epic` does manually for *single* issues. Worth A/B-ing against our orchestration on the next non-epic feature to see whether our bespoke design-reviewer + qa-tester + pr-reviewer chain wins on quality, or whether we're just re-implementing the official path. |
| P1 | **Anthropic first-party `hookify` plugin** — slash-command authoring for hooks | Generates conversation-pattern guards via `/hookify`, `/hookify:list`, `/hookify:configure`. Several of our `.claude/hooks/*.sh` are exactly this shape (`block-generated-edits`, `deny-subagent-merge`, `agent-bash-allowlist`). Future hooks could be authored interactively instead of hand-written shell. |
| P1 | **`wshobson/agents`** — registry of 185 agents + 80 plugins + 153 skills (34.8k stars) | The largest and best-maintained community pattern-library. Not "install all of it" — it's a reference for patterns we haven't yet codified (parallel sub-agent dispatch with state persistence, cross-package coordination contracts, workflow orchestrators). |
| P2 | **`VoltAgent/awesome-claude-code-subagents`** — 131 specialized subagents (19.1k stars) | Mine individually, don't adopt wholesale. Specific agents (accessibility-tester, qa-expert, type-checker, performance-profiler) are usable as direct upgrades to our `qa-tester` + `pr-reviewer` two-pass pipeline. |
| P2 | **Anthropic first-party `plugin-dev` plugin** — 7-skill toolkit + 8-phase scaffolding for plugin authoring | Relevant if we want to package our internal toolkit (`fe-endpoint`, `mongo-document`, `signalr-event`, `regen-api`, `web-page`, `mobile-screen`, `prototype-scene`, `ship-epic`) into a shareable plugin instead of keeping them in `.claude/skills/`. |
| P3 | **Anthropic first-party `ralph-wiggum` plugin** — `/ralph-loop` autonomous self-iterating tasks | Direct equivalent of our `superpowers:loop` skill. Read it, compare. If the official version handles error-state better, swap the references in `daily-resercher` and other scheduled tasks. |
| P3 | **`wshaddix/dotnet-skills`** — 167 .NET skills + 16 agents focused on ASP.NET Core, EF Core, testing | Small project (19 stars) but tight scope match with `backend-dotnet`. Worth scanning for skills we don't have — likely adds value around EF migrations, FastEndpoints idioms, xUnit + Testcontainers patterns. |

---

## 1. Anthropic first-party `feature-dev` plugin — A/B against `ship-epic`

**What it is:** A plugin shipped in `anthropics/claude-code/plugins/feature-dev/` that codifies a 7-phase feature workflow: **explore → architect → implement → test → refactor → review → ship**. Each phase has explicit gates and produces an artefact the next phase consumes.

**Source:** [anthropics/claude-code → plugins/feature-dev](https://github.com/anthropics/claude-code/tree/main/plugins/feature-dev) · invokable via `feature-dev:feature-dev` once the plugin is installed (it already shows in our skills list under that exact name).

**Where it slots in:**

We already orchestrate this shape, but split across artefacts: `design-reviewer` covers explore + architect (handoff JSON via `state/handoff-design-<issue>.json`), the dev sub-agents cover implement + test, `qa-tester` covers verify, `pr-reviewer` covers review, and the merge gate covers ship. The official plugin bundles these into one slash-command that an unfamiliar Claude Code instance could pick up cold.

What this is good for in our environment is **not** replacing `ship-epic` — that handles multi-issue epic orchestration which `feature-dev` doesn't. It's good for **single-issue work that doesn't justify epic machinery**:

- Standalone bug fixes (e.g. PR #229 register flow).
- Small refactors with no sub-issues.
- The "one quick endpoint" tasks that today launch the full design-reviewer → backend-dotnet → qa-tester → pr-reviewer pipeline.

The bet is that for low-coordination tasks, the official plugin's lighter-touch flow ships faster than our bespoke chain.

**Why this project specifically:**

- Our `design-reviewer` gate adds ~1 round-trip of latency for every issue, even trivial ones. The `feature-dev` "explore" phase is leaner.
- Provides an external benchmark for "does our orchestration actually produce better outcomes" — currently we have no honest comparison.
- If it loses the A/B, we drop it; if it wins on small-scope work, we route by issue size at dispatch time.

**Risk:** Adopting the plugin while keeping our chain risks two parallel ladders. Mitigation: hard rule that `feature-dev` is only invoked for issues without a `scope:*` cross-cut (single-package, ≤3 files in the dispatch brief's expected diff).

**Effort:** ~1 hour to read the plugin source + write the routing rule into `.claude/CLAUDE.md`. Then 2-3 small standalone issues over the next week to A/B.

**Fit score:** 4/5 — direct overlap with existing infra, but a real opportunity to test our assumptions.

---

## 2. Anthropic first-party `hookify` plugin — interactive hook authoring

**What it is:** A plugin shipped in `anthropics/claude-code/plugins/hookify/` that exposes `/hookify`, `/hookify:list`, `/hookify:configure` slash commands. Authoring a hook becomes a conversation: describe the trigger, describe the guard, the plugin generates the shell script + the `settings.json` entry.

**Source:** [anthropics/claude-code → plugins/hookify](https://github.com/anthropics/claude-code/tree/main/plugins/hookify) — install via plugin marketplace.

**Where it slots in:**

We currently maintain six bespoke hooks in `.claude/hooks/`:

- `block-generated-edits.sh` — blocks Edit/Write on `{web,mobile}/src/api/generated.ts`.
- `deny-subagent-merge.sh` — blocks `gh pr merge` and `git push --force` from sub-agents.
- `agent-bash-allowlist.sh` — per-agent bash command curation.
- `gate-check.sh` — JSON-schema validation of dev-handoff payloads.
- `reinject-state.sh` — re-hydrate `state/*.json` after `/clear` or compact.
- `split-compound-commands.sh` — splits `cmd1 && cmd2` for permission validation.

`hookify` doesn't replace these — they're already authored. It targets the *next* hook the orchestrator reaches for. Examples we've considered but not written:

- Block `notion-docs` from running between sub-issue and epic merges (already in [feedback memory](../.claude/projects/-Users-jan-Projects-fitness-platform/memory/feedback_post_merge_notion_docs.md), enforced by prose).
- Auto-kill stale `dotnet run` processes after `regen-api` (also feedback memory).
- Force-rebase sibling sub-issue branches after a sibling merge to the epic branch.

Each of those is a 30-line shell hook today. With `hookify` they become a 2-minute conversation. The win is the *next 5 hooks*, not the 6 we have.

**Why this project specifically:**

- Several of our auto-memory `feedback_*` entries are exactly the kind of thing a hook should enforce, not a prose memory to remember.
- Hookify generates `settings.json` entries that are correctly scoped (PreToolUse vs SubagentStop vs SessionStart) — we've hand-written this twice, gotten it wrong twice, fixed it twice.

**Risk:** Generated hook scripts may be naïve (no idempotency, no error handling). Treat hookify output as a draft, then handle the long-tail manually — same as scaffolding tools always require.

**Effort:** ~30 min to install + try on one hook (suggest: kill-backend-after-regen). If it produces a sane skeleton, adopt. If not, drop quietly.

**Fit score:** 4/5 — low risk, removes a manual chore, scales to the next-N hooks not the current ones.

---

## 3. `wshobson/agents` — community orchestration registry (34.8k stars)

**What it is:** The largest active Claude Code agent collection — 185 specialized agents, 80 plugins, 153 skills, 16 workflow orchestrators. Updated for Opus 4.7 / Sonnet 4.6 / Haiku 4.5. Not a single tool, but a meta-library of patterns.

**Source:** [wshobson/agents](https://github.com/wshobson/agents) — 34.8k GitHub stars (verified).

**Where it slots in:**

Not "install all of it" — that would be an actual nightmare for our context budget (153 skills × description-line overhead = significant tokens at session start). The right model is **read it as a reference**, lift specific patterns we haven't implemented:

- **Workflow orchestrators** are the closest analogue to our `ship-epic`. The repo has 16; ours has 1. Worth comparing for state-handoff conventions, dependency-resolution patterns, retry semantics on dev-agent failure, and how they handle partial-PR rollback.
- **Specialized review agents** beyond what `pr-reviewer` covers. Today our two-pass review is generalist; the repo has agents for type-design, security-by-default, performance-profiling, dead-code-detection. Each is invokable individually, so we could chain them as additional sub-passes when the diff matches a heuristic (e.g. a backend diff with `await` keywords → run the concurrency-review agent).
- **State persistence patterns** — they have multiple approaches to long-running task state (NDJSON event log, JSON snapshot, SQLite). We use `.claude/state/*.json`; their patterns may handle compaction and recovery better.

**Why this project specifically:**

- Our `pr-reviewer` two-pass gate is good but generalist. Specific review agents are likely cheaper (Haiku-able) and catch domain-specific issues better.
- `ship-epic` was written from scratch — we've never validated our orchestration shape against a 34.8k-star reference implementation. Even if we don't change anything, the comparison is cheap insurance.
- We routinely struggle with dev-handoff schema evolution. They've solved this once before; reading their schema patterns will save us a refactor.

**Risk:** Reading 153 skills end-to-end is a token sink. Mitigation: clone locally, grep for the patterns we care about (`workflow-orchestrator`, `state-handoff`, `review-agent`), read only those.

**Effort:** ~3 hours of focused reading + one pass to extract findings into a follow-up issue. Fan out from there.

**Fit score:** 4/5 — high informational value, low risk, but takes a deliberate session not a drive-by.

---

## 4. `VoltAgent/awesome-claude-code-subagents` — mine individual agents

**What it is:** A curated list of 131 specialized Claude Code subagents organized into 10 categories (security, accessibility, QA, performance, frontend, backend, devops, docs, AI/ML, productivity). 19.1k stars, 2.2k forks.

**Source:** [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — verified.

**Where it slots in:**

This is **not** a registry to install — it's a list of vetted individual agents, each linked to its own repo. The way to use it is to scan the categories, identify gaps in our pipeline, and adopt one agent at a time:

- **Accessibility-tester** — direct upgrade for our `design:accessibility-review` skill. Currently we run a11y as a one-off skill; the agent is a sub-pass that fires on every PR with UI changes.
- **Qa-expert** — comparison for our `qa-tester`. The categories overlap (AC verification, regression detection); the implementation differences are worth diffing.
- **Type-checker / performance-profiler** — additional `pr-reviewer` sub-passes for diffs matching specific heuristics (TS files for type-checker, useEffect-heavy diffs for perf).
- **Code-archaeologist** — git-history aware refactor suggestions; useful for `refactor:*` issues.

**Why this project specifically:**

- Our pipeline today is one-size-fits-all: the same `qa-tester` runs whether the change is a CSS tweak or a SignalR hub overhaul. Specialized agents matched to diff shape would be cheaper (Haiku-tier) and catch issues our generalist misses.
- The accessibility category is large and deep — we already have `a11y-accessibility` and `design:accessibility-review` installed but neither is wired into the AC gate. A specialist sub-agent would close that gap.

**Risk:** Sprawl. Adding agents without retiring the generalist makes every PR slower. Rule: each new specialist agent must have a heuristic that gates it on (only fires when the diff matches), not blanket-applied to every PR.

**Effort:** ~2 hours per agent adopted (read source, integrate into `pr-reviewer` second-pass). Start with one, evaluate after a week before adding the next.

**Fit score:** 3/5 — high quality material, but adopting individual agents is a slow drip rather than a one-shot upgrade.

---

## 5. Anthropic first-party `plugin-dev` plugin — package our toolkit

**What it is:** A plugin in `anthropics/claude-code/plugins/plugin-dev/` providing 7 skills + an 8-phase scaffolding workflow for authoring Claude Code plugins. Output: a `.plugin` file that can be shared, versioned, distributed via marketplace.

**Source:** [anthropics/claude-code → plugins/plugin-dev](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev) — verified.

**Where it slots in:**

We have ~12 internal skills under `.claude/skills/`: `fe-endpoint`, `mongo-document`, `signalr-event`, `regen-api`, `web-page`, `mobile-screen`, `prototype-scene`, `notion-docs`, `root-cause-swarm`, `ui-tradeoff`, `ship-epic`, `daily-resercher`. They live in the project tree, which means:

- Every fresh checkout (CI sandbox, new contributor) gets them automatically — good.
- They're not versioned independently of project code — bad for skills like `signalr-event` that have stable contracts independent of the rest of the monorepo.
- They can't be reused across projects (other repos in `~/Projects/` would have to copy-paste).
- They can't be shared with the team via the plugin marketplace.

`plugin-dev` is the path from "skills in `.claude/`" to "shareable, versioned plugin." Whether that's worth doing depends on whether we want a second project to reuse our skills (we do — Green Code projects could benefit from `fe-endpoint`, `mongo-document`).

**Why this project specifically:**

- Our `fe-endpoint` and `mongo-document` skills encode FastEndpoints + Mongo conventions that other Green Code projects use too.
- Maintaining 12 skills in one folder is starting to be its own project; tooling for plugin-dev has versioning, CHANGELOG, lint, test that our `.claude/skills/` directory doesn't.

**Risk:** Premature abstraction. If we never actually share these, packaging adds overhead with no payoff. Decision rule: only adopt if we've identified at least one concrete second-project consumer.

**Effort:** ~1 day to package the first 3 skills end-to-end. Iterates from there.

**Fit score:** 3/5 — useful but not urgent. Defer until we have a concrete cross-project need.

---

## 6. Anthropic first-party `ralph-wiggum` plugin — official autonomous loop

**What it is:** A plugin shipping `/ralph-loop` for autonomous self-iterating tasks until completion. Direct equivalent of the `superpowers:loop` skill we already have installed.

**Source:** [anthropics/claude-code → plugins/ralph-wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum) — verified.

**Where it slots in:**

`daily-resercher` (the skill that produced this very document) runs via `ScheduleWakeup` in dynamic mode plus the `superpowers:loop` skill for repeating tasks. That works, but `superpowers` is a third-party plugin family — if Anthropic's official `ralph-wiggum` handles the same loop semantics with better state-recovery, error-bounded retry, or cleaner stop conditions, swapping is cheap.

**Why this project specifically:**

- The `superpowers:loop` documentation is sparse on what happens when an iteration fails partway. `ralph-wiggum` being first-party means it'll evolve with Claude Code's lifecycle event model.
- Several scheduled tasks would benefit from autonomous self-iteration (e.g. `notion-docs` post-merge, currently fire-once).

**Risk:** Migrating mid-stream loops would lose state. Mitigation: only use `ralph-wiggum` for *new* loops, leave existing `superpowers:loop` invocations alone.

**Effort:** ~30 min to read the plugin source + try one loop. Compare on the next scheduled task that needs autonomous iteration.

**Fit score:** 2/5 — likely a wash with what we have, but worth the half-hour to know.

---

## 7. `wshaddix/dotnet-skills` — focused .NET skill collection

**What it is:** 167 skills + 16 agents narrowly scoped to .NET ecosystem: ASP.NET Core, EF Core, testing (xUnit + Testcontainers), security, CI/CD. Small repo (~19 stars verified) but tight match.

**Source:** [wshaddix/dotnet-skills](https://github.com/wshaddix/dotnet-skills) — verified, 67 commits.

**Where it slots in:**

Our `backend-dotnet` sub-agent currently leans on three skills: `fe-endpoint` (FastEndpoints scaffolding), `mongo-document` (Mongo aggregate scaffolding), `signalr-event` (cross-package realtime). That's three skills against a backend with 22 EF entities, 23 Mongo documents, 116 endpoints, 88 test files. The gaps:

- EF Core migrations — we have **zero** migration-helper skills, despite migrations being on the merge exclusion list (i.e. exactly the high-risk surface that would benefit from rigour).
- Testcontainers test scaffolding — we have the `testcontainers:testcontainers-dotnet` skill from a plugin, but no project-specific glue (our fixtures, our base test class conventions).
- xUnit theory data builders — repeated boilerplate across the 88 test files.
- FluentValidation pattern enforcement.

`wshaddix/dotnet-skills` likely covers some of these; worth a 30-min skim of its skill list to see which are direct lifts.

**Why this project specifically:**

- Our backend is the largest single package by file count (LoC). It has the fewest project-specific skills relative to its size.
- The merge-exclusion list (migrations, Mongo data scripts) flags exactly the surfaces where ad-hoc handwritten changes are riskiest. Skills for those surfaces are the highest-value gap.

**Risk:** A 19-star project may be one-person-maintained and could go stale. Adopt skills as one-time copy-ins, not as a live dependency.

**Effort:** ~30 min to scan + ~1 hour per skill we lift. Conservative target: 2 skills (migration-helper + xUnit theory builder).

**Fit score:** 3/5 — small project but the scope match is unusually tight.

---

## Skipped — already covered, duplicate, or low fit

For audit transparency:

- **`claude-code-owasp`** — duplicates `owasp-security` plugin we already have installed.
- **`senaiverse/claude-code-reactnative-expo-agent-system`** — 20 agents for Expo, but small (115 stars, October 2025); doesn't beat our `mobile-expo` sub-agent + `mobile-screen` skill on day-1 fit. Re-evaluate if it gets to ~500 stars.
- **`ruvnet/ruflo`** — swarm-intelligence orchestration platform; an order of magnitude more complex than we need. Track if our orchestration outgrows `ship-epic`.
- **`composio/test-writer-fixer`, `security-sweep`, `bug-fix`, `audit-project`, `senior-frontend`** — Composio plugin family, surfaced by scout but not independently verified in this run. Re-check next week with direct WebFetch on `awesome-claude-plugins`.
- **GitHub Projects MCP** — we use GitHub issues directly via `gh` CLI; no Projects board adoption planned, so no incremental value.

---

## Recommended next action

Three concrete moves, smallest first:

1. **30 min — install `hookify`** and use it to author the kill-backend-after-regen hook (the one in [feedback memory](../.claude/projects/-Users-jan-Projects-fitness-platform/memory/feedback_kill_be_after_regen.md)). If the generated script is sane, adopt; if not, drop the plugin.
2. **1 hour — read `feature-dev` source** and decide: do we route small standalone issues through it as an A/B against our chain, or does our `design-reviewer + qa-tester + pr-reviewer` already win on quality? Document the decision in `.claude/CLAUDE.md` either way.
3. **3 hours — clone `wshobson/agents`** and read the 16 workflow-orchestrators side-by-side with `ship-epic`. Extract the dependency-resolution and state-handoff patterns we don't have. File one follow-up issue per pattern.

Skip the rest until those three settle.

---

**Word count: ~2200. Compiled by `daily-resercher` skill (Haiku scouts + Opus synthesis). Verifications cross-checked against repo READMEs; star counts and last-commit dates as of 2026-05-05.**
