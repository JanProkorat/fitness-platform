# Claude Code Ecosystem — Follow-up Additions

**Compiled:** 2026-04-29 (scheduled `daily-resercher` run)
**Companion to:** [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
**Scope:** Items that yesterday's report didn't cover, or only mentioned in passing — focusing on official Anthropic features released in 2026 Q1 + a few fresh community pieces with concrete fit for the project.

> Anything already analysed yesterday (statusline, OWASP skill + GH Action, i18n audit, Expo MCP, Testcontainers skill, Delightful Design System, HTTP hooks, `cclint`, `claude-mem`) is **not** repeated here. This is strictly the *delta*.

---

## 0. TL;DR — what's new today

| Priority | Addition | Why it's worth re-evaluating |
|---|---|---|
| P1 | **Anthropic's "Code Review for Claude Code"** (parallel multi-agent PR reviewer, beta March 2026) | Could replace or complement the project's bespoke `pr-reviewer` two-pass — runs N parallel agents on Anthropic infra, ~84% finding rate on PRs >1k lines, ~$15–25/PR. |
| P1 | **`dotnet-claude-kit` (codewithmukesh)** — 47 skills + **15 Roslyn MCP tools** | The Roslyn-MCP angle (proper AST queries, not regex) is genuinely new vs the existing `backend-dotnet` agent. Could power refactors and fix-ups that today rely on `grep`. |
| P2 | **Anthropic "Agent Teams"** (experimental native multi-agent) | Built-in shared task list across team-lead + teammates; would test whether the custom `ship-epic` orchestration could be simplified by leaning on first-party scaffolding. |
| P2 | **`lackeyjb/playwright-skill`** (skill, not MCP) | Lower context cost than the `playwright` MCP plugin currently used by `qa-tester`; explicit visual-regression patterns with `toHaveScreenshot()`. |
| P3 | **`expo-mcp` + `xc-mcp` autonomous testing pattern** | Yesterday's report mentioned Expo MCP separately. The combined-with-xc-mcp testID-driven autonomous iOS testing pattern is the actual published workflow — worth considering as a replacement for `qa-tester`'s current XcodeBuildMCP-only loop. |
| P3 | **`hesreallyhim/awesome-claude-code` registry** | Single-source curated index — useful as the shortlist for future scheduled `daily-resercher` runs (replaces ad-hoc googling). |

---

## 1. Anthropic's official Code Review feature (March 2026)

**What it is:** Anthropic launched **Code Review for Claude Code** on 2026-03-10 — a parallel-agent system hosted on Anthropic infrastructure that scans pull requests for bugs, security vulnerabilities, and code-quality regressions. Multiple agents look for distinct issue classes simultaneously, then a verification step checks each candidate against actual code behaviour to filter false positives. Distinct from the older `claude-code-security-review` GitHub Action — this is general-purpose, not just security.

Reported numbers from Anthropic's launch post:

- PRs >1000 lines: **84% receive findings**, average **7.5 issues**.
- PRs <50 lines: **31% receive findings**, average **0.5 issues**.
- **<1% of findings marked incorrect** by reviewing engineers.
- **$15–$25 per PR** typical, scales with diff size.
- Beta on **Team and Enterprise plans only** (research preview).

**Where it would slot in:**

The project's `pr-reviewer` already runs a two-pass review (self-review via the `review` skill + a fresh-eyes sub-reviewer dispatched blind via the `Agent` tool). Anthropic's hosted system is structurally similar but:

- Runs **in parallel on Anthropic infra**, not local — much faster turnaround on large PRs.
- The **verification step** is what the current setup most explicitly lacks; the project's pr-reviewer can over-report on speculative findings and the orchestrator has to filter. Hosted verification would automate that.

Concrete options:

1. **Replace the second-pass sub-reviewer** with the hosted feature on PRs >500 lines. Keep the project-aware first-pass self-review intact (it's the only place project-specific gates like `regen-api` write-locks, design-token bans, and the `Migrations/**` exclusion live).
2. **Run hosted in addition to** the existing two-pass on epic-level PRs only (where the diff cost matters most and the $15–25 spend is amortised over many sub-issues).
3. **Skip for sub-issue PRs** (base = epic branch). The project's auto-merge model means sub-issues get heavy local review already; paying $15+ each would 5–10× the per-epic spend.

**Why this project specifically:**

- Recent epic PRs have run >1500 lines (#67 photo-diary epic, the photo-feature epic). 84% find-rate would have caught real issues earlier.
- The project's hard-rule gate (auto-generated files, scope-tagged fix routing) is *orchestration logic*, not review heuristic — so layering the hosted review on top doesn't conflict; it lives in the second-pass slot.
- Plan tier needs verification — the project owner is on a personal/team plan; if Enterprise-only blocks this, fall back to keeping the current setup.

**Risk:** Hosted reviews submit the diff to Anthropic infra. Already true for any Claude Code call but worth flagging — the project has trainer/client PII flowing through some endpoints.

**Effort:** ~15 min if eligible; the feature wires in via a setting in the Claude Code app or a single workflow file. Skip if not on Team/Enterprise plan.

---

## 2. `dotnet-claude-kit` — the Roslyn MCP angle

**What it is:** A 2026 .NET 10 / C# 14 kit (codewithmukesh) bundling:

- **47 skills** (CLAUDE.md templates, project-structure rules, FastEndpoints scaffolds, EF Core patterns, security/perf playbooks).
- **10 specialist agents** (test-engineer for xUnit v3 + Testcontainers, security agent, perf agent, refactor agent, etc.).
- **16 slash commands** (scaffold-feature, audit-deps, generate-test, fix-style, etc.).
- **15 Roslyn MCP tools** — this is the bit yesterday's report missed.
- **7 hooks** (PreToolUse safety, PostToolUse format/test, Stop summarisers).
- **5 project templates**.

The **Roslyn MCP tools** are the new thing. Today the `backend-dotnet` agent edits .NET code via `grep` + `Read` + `Edit`. Roslyn-MCP gives it actual semantic queries: "find all `IServiceCollection.AddScoped` registrations of types implementing `IClientNotifier`," "rename `IPhotoStore.GetAsync` and update every caller including override matrix," "list all `[Authorize]` endpoints with no role/policy attribute." Regex can't do those reliably; Roslyn can.

**Where it would slot in:**

- **Cherry-pick the Roslyn MCP** and add it to `~/.claude/mcp.json` for `backend-dotnet` only. Don't install the whole kit — yesterday's report correctly flagged that wholesale install conflicts with the project-specific `fe-endpoint` and `mongo-document` skills.
- **Use it for refactor-class issues** specifically (`type:refactor` labelled work). Bug-fixes and feature work are well-served by current grep+edit; refactors that touch interface signatures are where today's setup gets brittle.

**Why this project specifically:**

- The backend has 22 EF entities, 23 Mongo documents, 11 service interfaces, ~116 endpoints. A signature change rippling through 116 endpoints is exactly where regex misses an override or implicit interface implementation.
- Recent work (PR #149 GuidSerializer) involved a `ModuleInitializer` change that needed verifying-by-grep across the test surface; Roslyn would have answered directly.
- xUnit v3 migration (if/when) — Roslyn-aware refactoring is much safer than regex sweeps.

**Effort:** ~20 min to install Roslyn MCP standalone. **Don't** install the rest of the kit; cherry-pick patterns into existing project skills if useful, but the project's skills are tighter for its conventions.

---

## 3. Anthropic "Agent Teams" — native multi-agent (experimental)

**What it is:** A native Claude Code feature that lets one session act as a "team lead," coordinating multiple "teammates" via a shared task list. Each teammate runs in its own context window. Communicate directly with each other, not just back through the lead.

**Status:** Experimental, disabled by default.

**Where it could slot in:**

The project already has a sophisticated custom orchestration (`ship-epic` skill, parallel sub-agent dispatch, `.worktrees/<N>-<short>/` git-worktree isolation per sub-issue, the qa→review→merge gate). Agent Teams covers some of the same ground but:

- **Shared task list** — the project today simulates this via the orchestrator's `TodoWrite` + the workflow agents' return summaries. A first-class shared list could reduce the orchestrator's "stitch return values back together" overhead.
- **Direct teammate ↔ teammate communication** — the project's design is hub-and-spoke (orchestrator brokers everything). Direct communication could let, e.g., `web-react` ask `backend-dotnet` for a quick endpoint shape clarification without round-tripping through the orchestrator. But — direct communication breaks the project's invariant that each sub-agent's package boundary is enforced by the orchestrator. Trade-off worth thinking about.

**Recommendation:** **Don't adopt** in the short term. The project's custom orchestration is mature, is documented in `.claude/CLAUDE.md`, and encodes invariants (epic-branch model, scope-tag routing, merge-exclusion list) that Agent Teams doesn't know about. **Do track** the feature — once it stabilises and supports custom routing rules, a port from custom orchestration to Agent Teams could simplify the codebase.

**Effort to evaluate:** ~30 min spike on a non-critical issue. Don't migrate epic flow until the feature exits experimental.

---

## 4. `lackeyjb/playwright-skill` — Playwright as a Skill (not MCP)

**What it is:** A Claude Code Skill (not an MCP server) for browser automation with Playwright. Auto-loads `API_REFERENCE.md` only when needed, advertised as "less context than `playwright-MCP`." Includes documented visual-regression patterns:

- Animations disabled globally for screenshot stability.
- `maxDiffPixelRatio: 0.01` for anti-aliasing tolerance.
- Baseline-management workflow (`toHaveScreenshot()`, `--update-snapshots`).

**Where it would slot in:**

The project's `qa-tester` agent currently uses the `playwright` MCP plugin (per `.claude/CLAUDE.md`) for AC flows and prototype-fidelity diffs. The MCP loads its full API surface into context every session. The Skill version loads `API_REFERENCE.md` only when invoked — meaningful context savings on long QA loops.

The visual-regression patterns are a more direct fit for the project's "prototype-fidelity diff" workflow than the current ad-hoc screenshot comparison. Today's diffs are visual but not pixel-exact; adopting `toHaveScreenshot()` baselines on key screens would catch real regressions automatically.

**Why this project specifically:**

- Mobile work especially benefits — animation/layout regression is the #1 cause of "the user said it doesn't work twice in a row" loops (the working principle that triggers the `ui-tradeoff` skill).
- Web prototype scenes (`docs/prototypes/trainer/scenes/*.html`) are stable references — perfect baseline candidates.
- Replacing MCP with Skill saves context budget on every `qa-tester` dispatch — small per-call but cumulative across an epic.

**Trade-off:** MCP is bidirectional and live; the Skill model still needs Playwright running locally. Keep MCP for live-driven AC flows (form fills, click sequences); use the Skill specifically for screenshot-baseline workflows.

**Effort:** ~30 min to install + bootstrap a baseline set for the top 5 web routes and top 5 mobile screens. Re-baseline on intentional UI changes.

---

## 5. `expo-mcp` + `xc-mcp` — autonomous iOS testing pattern

**What it is:** A **published workflow** (Smithery's `claude-mobile-ios-testing`) combining two MCP servers:

- **`expo-mcp`** — the Expo-hosted remote MCP. Drives React Native DevTools, queries components, interacts with the running app via testIDs.
- **`xc-mcp`** — simulator lifecycle (boot, install, screenshot, log capture, teardown).

The pattern: Claude **autonomously writes RN component tests by testID, runs them in the simulator, screenshots to verify UI, fixes issues it finds, re-runs.** No human in the loop for the inner test-iterate cycle.

**Where it would slot in:**

The project's `qa-tester` today uses **XcodeBuildMCP** for iOS Simulator (boot, install dev-client, screenshot). It does NOT currently have testID-aware component-level interaction — the simulator path is "boot the app, screenshot the screen, check the screenshot," which catches gross regressions but not, e.g., "this button is rendered but tapping it doesn't fire."

Adding `expo-mcp` (already on yesterday's P2 list as a fit) **plus** the testID-driven testing pattern would let `qa-tester` actually drive the app like a real test runner — tap a button, wait for a state change, assert text content — instead of pixel-checking.

**Why this project specifically:**

- AC failures on mobile work most often come from interaction bugs, not layout (per recent epic #67 commits — overlay tokens, color tokens, message-textarea fixes — all interaction-adjacent).
- The recent `mobile/test-results/` directory in the working tree status suggests interaction tests are at least partially in place locally; this pattern would integrate them into the QA gate.

**Caveat:** This requires testIDs on every interactive component. Today the codebase has spotty testID coverage (mostly the SignalR-connected screens). Adopting this pattern means a one-time sweep to add testIDs across the mobile component tree — a real cost.

**Effort:** ~2 h to install both MCPs + draft a testing playbook. **+ 4–8 h** for the testID coverage sweep on top mobile screens. Best done as its own scoped issue, not bundled into another PR.

---

## 6. `hesreallyhim/awesome-claude-code` — single-source registry

**What it is:** A community-maintained curated list of skills, hooks, slash commands, agent orchestrators, applications, and plugins. Distinct from `ComposioHQ/awesome-claude-plugins` (focus on the plugin system specifically) and `travisvn/awesome-claude-skills` (skills only) — `hesreallyhim/` is the broadest registry.

**Where it would slot in:**

This is **infrastructure for the `daily-resercher` task itself** — not a runtime addition to the project's orchestration.

Today this scheduled task does ad-hoc web searches across Google + DEV + Composio + various blogs. Most of those results re-cite a small handful of curated registries. Pinning the search to:

1. `hesreallyhim/awesome-claude-code` (broadest)
2. `ComposioHQ/awesome-claude-plugins` (plugin-system specifics)
3. Anthropic's official `claude-code` repo's `plugins/` directory
4. `claudemarketplace.com` (community directory, ~150+ entries)

…would produce more focused, higher-quality results than the current general web search.

**Recommendation:** Update the `daily-resercher` SKILL.md to direct the search at these registries first, with a fallback to web search only for items not present in the registries. Yesterday's report has nearly all the registry-listed items already covered — meaning future runs may find diminishing returns *unless* the search is repointed at the long tail.

**Effort:** ~10 min to update `daily-resercher/SKILL.md`. Largest single ROI item in this report — improves every future scheduled run.

---

## What's NOT in this report (already in yesterday's)

For continuity, yesterday's report covers these and they are **not re-evaluated here**:

- Statusline (CCometixLine, ccstatusline)
- OWASP skill + `claude-code-security-review` GH Action
- i18n audit skills (`i18n-expert`, `i18n-scan`)
- Expo official MCP (yesterday: doc-search angle; today: testing-pattern angle in §5)
- Testcontainers Claude skill
- Delightful Design System plugin
- HTTP hooks
- `cclint`
- `claude-mem`
- `Aaronontheweb/dotnet-skills` (yesterday's honourable mention; today §2 covers a *different* dotnet kit)

---

## Suggested execution sequence (delta vs yesterday's plan)

1. **This week (cheapest, highest leverage):** Update `daily-resercher` SKILL.md to point at the curated registries (§6). Saves token spend on every future run.
2. **Within next epic cycle (defensive):** Evaluate Anthropic's hosted Code Review feature (§1) — needs a plan-tier check first. If eligible, trial on the next epic-level PR only.
3. **When the next major refactor lands:** Cherry-pick Roslyn MCP from `dotnet-claude-kit` (§2). Don't install the whole kit.
4. **As a standalone scoped issue (not bundled):** TestID coverage sweep + `expo-mcp`/`xc-mcp` adoption (§5). Significant up-front cost; significant long-term QA value.
5. **Track but don't adopt:** Anthropic Agent Teams (§3). Re-evaluate when it exits experimental.
6. **Drop into `qa-tester` opportunistically:** `playwright-skill` for screenshot-baseline-driven tests (§4). Skill mode for visual regression; keep the existing MCP for live AC flows.

---

## Sources

- [Code Review for Claude Code — Anthropic announcement (2026-03)](https://claude.com/blog/code-review)
- [InfoQ — Anthropic Introduces Agent-Based Code Review for Claude Code (2026-04)](https://www.infoq.com/news/2026/04/claude-code-review/)
- [Code Review — Claude Code Docs](https://code.claude.com/docs/en/code-review)
- [`anthropics/claude-code` — `plugins/code-review/` README](https://github.com/anthropics/claude-code/blob/main/plugins/code-review/README.md)
- [`codewithmukesh/dotnet-claude-kit` (47 skills, 10 agents, 15 Roslyn MCP tools)](https://github.com/codewithmukesh/dotnet-claude-kit)
- [.NET Claude Kit landing page](https://codewithmukesh.com/resources/dotnet-claude-kit/)
- [Shipyard — Multi-agent orchestration for Claude Code in 2026 (Agent Teams)](https://shipyard.build/blog/claude-code-multi-agent/)
- [Claude Code Agent Teams — Setup & Usage Guide 2026](https://claudefa.st/blog/guide/agents/agent-teams)
- [`lackeyjb/playwright-skill` — Skill, not MCP](https://github.com/lackeyjb/playwright-skill)
- [HN — Show HN: Playwright Skill for Claude Code (less context than playwright-MCP)](https://news.ycombinator.com/item?id=45642911)
- [Smithery — `claude-mobile-ios-testing` (expo-mcp + xc-mcp)](https://smithery.ai/skills/krzemienski/claude-mobile-ios-testing)
- [Expo MCP Server — Expo Docs](https://docs.expo.dev/eas/ai/mcp/)
- [`hesreallyhim/awesome-claude-code` — broadest curated registry](https://github.com/hesreallyhim/awesome-claude-code)
- [`ComposioHQ/awesome-claude-plugins` — plugin-system specifics](https://github.com/ComposioHQ/awesome-claude-plugins)
- [`travisvn/awesome-claude-skills` — skills only](https://github.com/travisvn/awesome-claude-skills)
- [Awesome Claude Skills marketplace](https://awesome-skills.com/)
