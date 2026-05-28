# Claude Code Ecosystem — Day-6 Additions

**Compiled:** 2026-05-11 (scheduled `daily-resercher` run, 6 days after prior digest)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)
- [`claude-code-ecosystem-additions-2026-05-01.md`](./claude-code-ecosystem-additions-2026-05-01.md)
- [`claude-code-ecosystem-additions-2026-05-05.md`](./claude-code-ecosystem-additions-2026-05-05.md)

**Scope:** Items the prior five reports did not cover. The 6-day gap since 2026-05-05 turned out to be **harness-heavy, plugin-light**: Anthropic shipped eleven point-releases of the CLI (v2.1.128 → v2.1.138, mostly bug-fix tier) and two new first-party plugins. The community-side movement is concentrated in **context durability and agent-action governance** — exactly the surface our orchestrator hits hardest. Six items below, ordered by fit.

> Anything previously analysed (feature-dev, hookify, plugin-dev, ralph-wiggum, wshobson/agents, VoltAgent/awesome-claude-code-subagents, wshaddix/dotnet-skills, statusline tools, OWASP skill, i18n audit, Expo MCP, Testcontainers skill, Delightful Design System, HTTP hooks, cclint, claude-mem, hosted Code Review, dotnet-claude-kit, Roslyn MCP, Agent Teams, playwright-skill, axe-core / a11y skill, CocoIndex, Git Worktree MCP, claude-security-guardrails, async hooks, EARS / Axiom, ER Flow Database Architect, XcodeBuildMCP LLDB) is **not** re-covered here.

---

## 0. TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P1 | **`mksglu/context-mode`** — MCP server for sandboxed tool output + SQLite event tracking (14.3k stars, updated 2026-05-11) | Formalises what our `reinject-state.sh` + `.claude/state/ship-epic.json` does by hand. The boot-sentinel for this very session was "ship-epic state malformed" — that's the failure mode this MCP exists to fix. |
| P1 | **`alexgreensh/token-optimizer`** — context-bloat auditor for skills, hooks, memory files (952 stars, updated 2026-05-10) | Our session-start surface now loads ~60 KB of CLAUDE.md + rules + memory + skill descriptors. Worth a single audit pass to see what we're paying for but never use. |
| P2 | **Anthropic first-party `learning-output-style` plugin** — new in `anthropics/claude-code/plugins/` since 2026-05-05 | Configurable output mode that emphasises *why* over *what* in agent responses. Worth a look for new-contributor onboarding into our orchestration tree. |
| P2 | **`pegasi-ai/reins`** — deterministic policy framework for agent action governance (412 stars, updated 2026-05-08) | Richer policy model than our two custom hooks (`deny-subagent-merge`, `agent-bash-allowlist`). Lets us promote prose rules from `.claude/CLAUDE.md` to enforced policies — but the bar is "does this catch something our current hooks miss?" |
| P3 | **Harness releases v2.1.128 → v2.1.138** — eleven bug-fix releases between 2026-05-04 and 2026-05-09 | Auto-upgrade path; nothing to install. The OAuth MCP refresh fix is the headline — mid-session MongoDB / Playwright / GitHub MCP auth drops should be gone. |
| P3 | **Anthropic first-party `claude-opus-4-5-migration` plugin** — codemod for projects still on Opus 4.5 | We're already on 4.7 (and Sonnet 4.6 for impl work). Tracking-only — useful only if we adopt a sibling repo that's lagging. |

---

## 1. `mksglu/context-mode` — sandboxed-output MCP, plug-and-play for our state model

**What it is:** An MCP server that wraps every tool call's stdout in a sandbox, stores the full output in a local SQLite store, and only returns a short reference token to the model context. The model can later "open" the reference if it actually needs the full payload. The same SQLite store also tracks file edits, git operations, and user decisions across the session — survivable across `/clear`, `/compact`, and token-limit truncations.

**Source:** [mksglu/context-mode](https://github.com/mksglu/context-mode) — 14.3k stars verified, last updated 2026-05-11. Works with Claude Code, Gemini CLI, Cursor, OpenCode (one MCP server, multiple front-ends).

**Where it slots in:**

We already have a hand-rolled version of half of this:

- `.claude/state/ship-epic.json` is our long-running orchestration state.
- `reinject-state.sh` (a SessionStart hook) re-hydrates it after `/clear` or compact.
- The very first system reminder on **this** conversation said *"ship-epic state malformed — see .claude/hooks/log/2026-05-11.log"*. So our hand-rolled state-tracker has at least one bug surface right now.

`context-mode` would replace the JSON-file approach with a SQLite store the model talks to via MCP. Benefits:

- Schema validation handled by the MCP (today our `gate-check.sh` validates dev-handoff payloads against a manually-maintained JSON Schema).
- Sandboxed stdout means we stop paying full-page costs for `gh pr view`, `git log`, `dotnet build` output we only need a snippet of — those become reference tokens.
- Cross-tool state — the file-edit log alone would close a gap our orchestrator has: today the orchestrator doesn't know exactly *which* files a sub-agent touched without re-running `git status`.

**Why this project specifically:**

- The `ship-epic` orchestrator is exactly the long-running, multi-handoff, state-heavy workload this MCP targets. Five days of sub-issue PRs + epic rebases is the average load.
- We've already accepted the cost of an MCP server (Playwright, MongoDB, GitHub MCPs all running). Adding one more is incremental.
- The failure surface we hit on this session (`state malformed`) is one of the explicit pitches.

**Risk:** Replacing a working hand-rolled system with a 14.3k-star community project means we lose direct control of the state shape. Mitigation: install in **observer mode** first (let it track alongside our own JSON), compare for a week, then decide whether to retire the manual hooks.

**Effort:** ~1 hour to install + configure the MCP, ~2 hours over a week to compare outputs.

**Fit score:** 5/5 — direct match for a current operational pain point.

---

## 2. `alexgreensh/token-optimizer` — single-pass session-cost audit

**What it is:** A static analyser that scans a Claude Code workspace (`.claude/` tree, MEMORY.md, hooks, skill descriptors, plugin manifests) and reports what's eating tokens at session-start vs. what's actually used. Detects: unused skills (loaded by description but never invoked), stale memory entries, redundant hooks, oversized CLAUDE.md sections.

**Source:** [alexgreensh/token-optimizer](https://github.com/alexgreensh/token-optimizer) — 952 stars verified, last updated 2026-05-10. CLI tool, runs against any Claude Code project root. (Note: the previous scout claimed "98% context reduction" — the README is more conservative; the headline number applies to specific high-bloat starting points, not blanket every project.)

**Where it slots in:**

Our session-start payload has grown organically over five months. Today it includes:

- Root `CLAUDE.md` (~5 KB)
- `.claude/CLAUDE.md` (~9 KB orchestration playbook)
- Six `rules/*.md` files (~7 KB)
- `~/.claude/CLAUDE.md` global (~5 KB)
- `MEMORY.md` index + 9 memory files (~3 KB combined just for the descriptions)
- ~70 skill descriptors in the catalogue (each one a line of context)
- 13+ MCP servers, each loading its tool schemas

We've never audited which of those actually fire in the average session. There's almost certainly fat — for example, our memory file `feedback_mobile_dev_https.md` (saved this morning) is now duplicated information with `feedback_kill_be_after_regen.md` from last week.

**Why this project specifically:**

- Working Principles §6 explicitly calls out token discipline as a recurring failure mode.
- We're already paying ~20% of context window on session-start *before any user message*. Half that and we'd extend the 5h working window measurably.
- One-shot tool — no integration cost.

**Risk:** Tool may flag valid items as "unused" because their trigger is rare-but-important (e.g. `pps-mongo-connect` only fires when the user explicitly asks). Treat the report as *advisory*, not a hit list.

**Effort:** ~15 min to install + run. ~1 hour to triage the report.

**Fit score:** 4/5 — concrete and low-risk; the win is finite but real.

---

## 3. Anthropic first-party `learning-output-style` plugin

**What it is:** A new first-party plugin under [`anthropics/claude-code/plugins/learning-output-style/`](https://github.com/anthropics/claude-code/tree/main/plugins/learning-output-style), landed since the 2026-05-05 digest. Configures Claude to emphasise the **reasoning** behind decisions over the *what was done* — useful for sessions where a human is learning by observing.

**Source:** Verified in the anthropics/claude-code plugins directory; one of two new entries since Day 5 (the other is `claude-opus-4-5-migration`, see §6).

**Where it slots in:**

Our orchestrator's default voice is terse, post-hoc reporting ("merged PR #254, dispatched notion-docs"). That's correct for the trained operator (you) but high friction for:

- A new contributor reading session transcripts to understand how `ship-epic` flows.
- The Notion changelog generator (`notion-docs`) — currently it has to reverse-engineer the *why* from `git log` + dev-handoff JSONs.
- Future-you, six months from now, opening an old transcript to remember "why did we route the SignalR work through backend-dotnet *before* mobile-expo?"

The plugin doesn't change orchestration shape; it changes the narration. Activating it on `daily-resercher`, `notion-docs`, and `ship-epic` could yield artefacts that read more like documentation than execution logs.

**Why this project specifically:**

- The Notion Changelog page is already known to be too large to patch in-place (saved as a project memory). Better, more-explanatory commit-time narration would make the dated sub-pages easier to skim retroactively.
- Onboarding documentation for the orchestration model is currently zero — the system is the whole runbook. Better narrated transcripts are a low-effort substitute until proper onboarding docs exist.

**Risk:** Verbose output costs tokens. Activate per-task, not globally — the orchestrator stays terse.

**Effort:** ~15 min to install + try on one `daily-resercher` run. Compare side-by-side with this very document for verbosity tradeoff.

**Fit score:** 3/5 — useful niche, not transformative.

---

## 4. `pegasi-ai/reins` — declarative policy framework for agent actions

**What it is:** An MCP-friendly policy engine that defines *deterministic*, *fail-closed* rules for what agents may and may not do. Looks like Open Policy Agent for the Claude Code tool-call layer. Examples from its README: "no `git push --force` on `main` or `develop`", "no `rm -rf` with absolute paths", "approval required before `gh pr merge` against `main`".

**Source:** [pegasi-ai/reins](https://github.com/pegasi-ai/reins) — 412 stars verified, last updated 2026-05-08.

**Where it slots in:**

We have **two custom hooks** doing exactly this:

- `deny-subagent-merge.sh` — blocks `gh pr merge` + `git push --force` from sub-agents.
- `agent-bash-allowlist.sh` — per-agent bash-command curation (`qa-tester` cannot `git commit`, etc.).

Both are bash scripts with hand-rolled string matching. `reins` would let us express these as declarative policies:

```yaml
policy: subagent_merge_ban
agents: [backend-dotnet, web-react, mobile-expo, qa-tester]
deny:
  - tool: Bash
    matches: "gh pr merge"
  - tool: Bash
    matches: "git push --force"
```

Plus richer rules we don't have today:

- "Block `dotnet ef database drop` from any agent, period." (Currently in `.claude/CLAUDE.md` as prose.)
- "Block direct edits to `appsettings.*.json` and `.env*` files." (Also prose-only.)
- "Require explicit user authorisation in same turn for `gh pr merge` against `develop` or `main`." (Today enforced by `pr-reviewer` instructions, not a hard hook.)

**Why this project specifically:**

- Several of our `.claude/CLAUDE.md` *prose* rules are exactly the shape that should be a *policy*: easy to express, easy to bypass by accident, costly when bypassed.
- Sub-agents have repeatedly tried to merge or force-push in past sessions — caught by the hooks today, but the bash-string matching is fragile (e.g. someone runs `gh pr merge --auto`, our hook may not catch a future variant).

**Risk:** Replacing working hooks with a new framework just because it's prettier is yak-shaving. Adopt only if `reins` catches a real gap our current hooks miss — file an issue listing the gaps first.

**Effort:** ~30 min to install + write the first 3 policies. Run alongside existing hooks for a week.

**Fit score:** 3/5 — solid match but not urgent; current hooks are working.

---

## 5. CLI harness releases v2.1.128 → v2.1.138

**What it is:** Eleven bug-fix releases shipped between 2026-05-04 and 2026-05-09. Anthropic's release notes are sparse ("Internal fixes"), but secondary sources (the first scout's WebFetch) flag two concrete improvements:

- **OAuth MCP refresh** — long-running sessions no longer lose auth to MongoDB / Playwright / GitHub MCPs mid-flight. Previously this caused daily re-auth friction on `qa-tester` runs that took >30 min.
- **Worktree HEAD selection** — `EnterWorktree` now reliably lands on the local HEAD; eliminates a subtle branch-tracking bug that hit epic rebases.

**Source:** [anthropics/claude-code releases](https://github.com/anthropics/claude-code/releases). Note: release notes are minimal — specific feature claims are inferred from the secondary scout, not directly verifiable from the release page text.

**Where it slots in:**

Zero install effort; auto-applies on next CLI update. The OAuth fix in particular matters for our `qa-tester` workflows that run packaged-backend curl probes + Playwright simulator drives against `:5101` for tens of minutes. Same for `notion-docs` writing 6 sub-pages over multiple GitHub MCP calls.

**Why this project specifically:**

- Three of our integrated MCPs (MongoDB, Playwright, GitHub) were affected by the pre-fix OAuth drop behaviour.
- Epic-branch sub-issue dispatch (the worktree-heavy path) is exactly where the HEAD-selection bug bit.

**Risk:** Pure upgrade. Risk = whatever else changed in 11 untagged bug-fix releases. Low.

**Effort:** Run `claude --update` or whatever the CLI's self-update is. Verify version with `claude --version`.

**Fit score:** 4/5 — free win, immediate.

---

## 6. Anthropic first-party `claude-opus-4-5-migration` plugin

**What it is:** A first-party plugin under [`anthropics/claude-code/plugins/claude-opus-4-5-migration/`](https://github.com/anthropics/claude-code/tree/main/plugins/claude-opus-4-5-migration). Codemod / orchestration toolkit for projects still pinned to Opus 4.5 that want to roll forward to 4.6 / 4.7.

**Source:** Verified in the plugins directory; landed since the 2026-05-05 digest.

**Where it slots in:**

We're already on Opus 4.7 (for design, review, planning) and Sonnet 4.6 (for impl work) per the model-selection matrix in `~/.claude/CLAUDE.md`. So we have **no migration need** for this project.

**Why this project specifically — almost not at all:**

The only scenario it'd fire is a sibling repo that hasn't kept up. Green Code projects (`capacity-planning`, `manufactory`, `migration-management`) might still have stale model pins in their `.claude/CLAUDE.md` files. If so, this plugin is the right tool for that cleanup — but it's not a fitness-platform task.

**Risk:** None — non-applicable plugin.

**Effort:** Zero.

**Fit score:** 1/5 — tracking-only. Useful as a *reference for the eventual 4.7 → 4.8 migration* when that lands; the pattern is reusable.

---

## Skipped — already covered, duplicate, or low fit

For audit transparency:

- **`getzikra/Zikra` (7 stars, PostgreSQL + pgvector team memory)** — overlaps our existing MEMORY.md + auto-memory pipeline. Cross-project memory is interesting in principle but we have no concrete second-project consumer yet. Track if a Green Code project asks for shared memory access.
- **`DeepSeek-V4-Claude-Code` MCP (5 stars)** — fallback model for cost-sensitive tasks. Our model-selection matrix already covers tiered routing (Haiku for scouts, Sonnet for impl, Opus for design/review). Adding a non-Anthropic model adds a quality variable we don't need.
- **Continuing community noise around context optimisation skills (numerous 50–200-star repos)** — `context-mode` and `token-optimizer` are the credible heads of this category. The rest re-implement the same ideas with smaller user bases. Re-evaluate in 30 days if any cross 1k stars.
- **Anthropic newsroom posts** — no Claude Code-branded announcement in the last 14 days. The harness releases are the only signal.

---

## Recommended next action

Three concrete moves, in priority order. The first one addresses an *actively-failing* surface (this session opened with a `ship-epic` state corruption notice), so it leads.

1. **1 hour — install `context-mode` MCP in observer mode.** Configure it alongside our current `state/ship-epic.json` for the next epic. Compare the SQLite-backed event log against our manual state file for one full epic cycle. If it captures the state-corruption case we hit this morning (the `state/ship-epic.json` malformed sentinel), retire `reinject-state.sh` + the hand-rolled JSON store.

2. **15 min + 1 hour triage — run `token-optimizer`** against this repo's `.claude/` tree. Read the report, dismiss false positives, retire what's genuinely unused. The win is durable — every future session benefits.

3. **30 min — install Anthropic's `learning-output-style` plugin** and trial it on the next `notion-docs` run. If the narrated output makes the changelog sub-pages more useful, keep it active for `daily-resercher` + `notion-docs`. If it just bloats responses, drop it.

Skip the rest until those three settle. `reins` waits for a real gap our hooks missed. `claude-opus-4-5-migration` waits forever (or until a sibling repo needs it). Harness releases auto-apply.

---

**Word count: ~2400. Compiled by `daily-resercher` skill (Haiku scouts + Opus synthesis). Findings verified via direct WebFetch of GitHub repo pages on 2026-05-11; star counts and last-commit dates as of that date. Two corrections vs. raw scout output: `token-optimizer`'s headline claim is bloat-elimination (not "98% context reduction" blanket-applied), `context-mode`'s core value is sandboxed tool output with event-log continuity (not just session persistence).**
