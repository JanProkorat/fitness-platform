# Claude Code Ecosystem — Day-3 Additions

**Compiled:** 2026-04-30 (scheduled `daily-resercher` run)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)

**Scope:** Items neither prior report covered. Three days in, the obvious wins (statusline, OWASP scanner, i18n audit, Expo MCP, hosted Code Review, Roslyn MCP, playwright-skill) are documented — the long tail is where today's research went. Six items below, ordered by fit score.

> Anything previously analysed (statusline tools, OWASP skill, i18n audit, Expo MCP, Testcontainers skill, Delightful Design System, HTTP hooks, `cclint`, `claude-mem`, hosted Code Review, `dotnet-claude-kit` / Roslyn MCP, Agent Teams, `playwright-skill`, `expo-mcp`+`xc-mcp`, awesome-claude-code registries) is **not** re-covered here.

---

## 0. TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P1 | **GitHub MCP server** (official, with `tail_lines`) | Direct replacement for the manual `gh run view <id>` step in `pr-reviewer`'s rule §8b CI-log diagnosis. |
| P1 | **Pact (`pact-net` + `pact-js`)** consumer-driven contract testing | Catches backend ↔ web/mobile schema skew at PR time, not at `qa-tester` time. Fits the cross-package hand-off in routing rule 2. |
| P2 | **`claude-a11y-skill` + axe-core MCP** | Plugs the missing accessibility gate before `qa-tester` PASS — currently spotty WCAG enforcement on `web-page` / `mobile-screen` outputs. |
| P2 | **CocoIndex Code (Tree-sitter + vector index)** | Token-discipline play: shared semantic index across all sub-agents, replaces grep-bloat on cross-package lookups. |
| P3 | **Git Worktree MCP** | Automates the `.worktrees/<N>-<short>/` lifecycle described in `.claude/CLAUDE.md` — including the sibling-rebase step after a sub-issue merge. |
| P3 | **`claude-security-guardrails` hooks** | Makes the security baseline in `~/.claude/CLAUDE.md` machine-enforceable via PreToolUse instead of policy-text. |

---

## 1. Official GitHub MCP server — replaces manual CI-log diagnosis

**What it is:** GitHub's first-party MCP server (`github/github-mcp-server`). Exposes Issues, PRs, Releases, Actions, and — relevant here — **workflow run logs with a `tail_lines` parameter** so an agent can pull the failing job's tail without dumping the whole log into context.

**Source:** https://github.com/github/github-mcp-server

**Where it slots in:**

`pr-reviewer`'s rule §8b ("Pre-merge CI gate") already mandates `gh pr checks <N>` before any merge. When a check is `fail`, the orchestrator currently has to:

1. Read `gh pr checks <N>` output, find the failing job ID.
2. Run `gh run view <id> --log` (often hundreds of KB of context).
3. Diagnose root cause manually.
4. Route the fix to the owning dev sub-agent.

The GitHub MCP collapses 1–2 into a single tool call with `tail_lines: 200`. Combined with the auto-memory rule "kill backend after short-lived runs," this also reduces context burn on every CI-failure round trip — typical `gh run view --log` output is 50–200 KB; a tail is <5 KB.

**Why this project specifically:**

- The merge gate is **the** highest-friction step in the orchestration today. Recent multi-package epics (epic #67) had multiple CI cycles per sub-issue PR; each manual diagnosis chewed Opus context.
- The auto-memory entry `feedback_check_ci_before_merge.md` is precisely a workflow this MCP makes deterministic.
- Side-benefit: `pr-reviewer` could read PR review comments/threads directly instead of manually re-fetching with `gh pr view`.

**Risk:** Auth scope — GitHub MCP needs a PAT. Use a fine-grained token scoped to the `JanProkorat/fitness-platform` repo only, with `actions:read` + `pull-requests:write` + `issues:write`. Not the same blast radius as a classic PAT.

**Effort:** ~15 min to install + provision a fine-grained PAT. Update `pr-reviewer`'s SKILL.md to prefer the MCP over `gh run view --log` when diagnosing CI failures.

**Fit score:** 5/5 — direct replacement for an existing manual step.

---

## 2. Pact contract testing — catches schema drift before QA

**What it is:** Consumer-driven contract testing across `pact-net` (backend producer) + `pact-js` (web/mobile consumers). Consumer writes an expectation against the API ("when I call `GET /trainer/clients/{id}`, the response has these fields with these types"); producer's CI verifies its actual responses match every consumer's expectation. Mismatches fail the producer build before merge.

**Sources:**
- https://pactflow.io / https://docs.pact.io
- https://github.com/pact-foundation/pact-net (.NET producer side)
- https://github.com/pact-foundation/pact-js (TS consumer side)

**Where it slots in:**

Today's `regen-api` skill regenerates `web/src/api/generated.ts` and `mobile/src/api/generated.ts` from the running backend's Swagger doc. That guarantees **type alignment**, but only for what NSwag projects from the OpenAPI document — it doesn't catch:

- Response field renames where the type stayed the same (e.g. `clientId` → `userId`, both `string`).
- Nullable changes the OpenAPI doc didn't reflect.
- Default-value changes (e.g. `pageSize` default 50 → 25 — silent breaker for callers that relied on the default).
- Behavioural changes that have no schema impact (e.g. a 200 turning into a 204 for empty results).

Pact catches all four because the consumer encodes *expectations on real behaviour*, not just types. A `qa-tester` AC failure today often surfaces these as flaky integration test fallout — Pact catches them at PR time on the producer side.

**Why this project specifically:**

- 116 backend endpoints, 19 web API modules, 12 mobile API modules. The cross-package fan-out is exactly Pact's sweet spot.
- The rule-2 hand-off ("backend finishes → web/mobile run regen-api → consume") would gain a hard contract gate. Sub-issue PRs that change a producer response shape would fail backend CI before web/mobile even starts.
- xUnit + Testcontainers backend already has the harness Pact verification expects.

**Trade-off:** Real upfront cost — every consumer endpoint needs a pact written (or auto-generated from existing test cases). Best done incrementally: start with the 5–10 endpoints that have changed shape most in 2026 (Today screen, dashboards, plan publish flow), extend over time.

**Effort:** ~1 day for a pilot — pick 3 high-traffic endpoints, write consumer pacts in `web/`, wire `pact-net` verification into the existing xUnit Testcontainers run. Expand later as a scoped issue (`type:chore` + `scope:backend`).

**Fit score:** 4/5 — high ceiling but real adoption cost.

---

## 3. `claude-a11y-skill` + axe-core MCP — accessibility gate

**What it is:** A skill (`airowe/claude-a11y-skill`) bundling axe-core, jsx-a11y static rules, and WCAG 2.2 AA checks into a single invocation. Pairs with axe-core MCP servers that drive the audit live against a running browser session.

**Source:** https://github.com/airowe/claude-a11y-skill

**Where it slots in:**

`qa-tester` today verifies AC and visual fidelity via Playwright MCP — but not accessibility. The project's CLAUDE.md notes Czech/English/German support and i18n parity gates, but no a11y gate. New scaffolds from `web-page` / `mobile-screen` ship without an automated WCAG check.

Concrete chain:

1. Web sub-agent finishes a new page or modifies an existing one.
2. `qa-tester` runs Playwright AC flow as today.
3. **New:** `qa-tester` also runs `claude-a11y-skill` against the same routes — reports WCAG violations (color contrast, missing labels, missing focus rings, keyboard traps).
4. WCAG violations route back to `web-react` as scope-tagged fixes before AC PASS, same flow as routing rule 6c.

**Why this project specifically:**

- EU regulatory tail-wind — WCAG conformance is increasingly a compliance line for fitness/health products in EU markets where the app targets cs/en/de.
- Trainer portal forms (plan editor, questionnaire builder, message bubbles) are exactly where keyboard navigation and screen-reader labels get missed.
- Brand accent `#c9a84c` (gold) on dark backgrounds is contrast-sensitive — easy to miss a violation without an automated check.

**Caveat:** This is web-side primarily. React Native a11y is harder to automate from the same skill — Expo has `accessibilityLabel`/`accessible` props but axe-core can't drive those. For mobile, rely on the `engineering:accessibility-review` skill the project already has installed (per the system-reminder skill list) — manual but informed.

**Effort:** ~30 min install + write a `qa-tester` recipe to run the a11y skill on every web AC pass. ~2 h to clean up the initial findings on existing pages. Re-runs on every new page free thereafter.

**Fit score:** 4/5 — closes a real gap, low adoption cost.

---

## 4. CocoIndex Code — semantic monorepo index

**What it is:** AST-aware codebase indexer: Tree-sitter chunks code by symbol/scope, embeddings stored in a vector DB (Turbopuffer-backed by default, swappable). Available as CLI, MCP server, and Claude Code skill. Cited 70% token reduction per turn vs. raw grep, 80–90% cache hit rate on incremental re-indexing.

**Source:** https://cocoindex.io / https://github.com/cocoindex-io/cocoindex

**Where it slots in:**

The project's monorepo is wide (3 packages + docs + infra) but each sub-agent's package boundary means cross-package lookups are common: web-react needs to know what response shape backend returned; mobile-expo needs to find every consumer of a SignalR event; backend-dotnet refactor needs to find every place that depends on a DTO.

Today these searches happen via grep across the orchestrator's main context — token-expensive and sometimes wrong (regex doesn't know about TypeScript imports or C# `using` aliases).

CocoIndex's semantic chunking would let each sub-agent ask "find every consumer of `ClientNutritionPlanPublished`" and get a structured answer (file + symbol + chunk text) without pulling 20 files into context. Especially valuable for the `feature-dev:code-explorer` agent already in the toolchain.

**Why this project specifically:**

- Token discipline is an explicit auto-memory line; this is a token-efficiency multiplier on every cross-package task.
- The existing `Explore` sub-agent description says "reads excerpts rather than whole files" — that's literally what CocoIndex does, but with vector recall instead of grep precision. They complement: Explore for tight known queries, CocoIndex for fuzzy "find anything related to X" queries.

**Trade-off vs. day-2 dotnet-claude-kit Roslyn MCP:** Roslyn is .NET-only and AST-precise (semantic queries on C# specifically). CocoIndex is whole-repo and AST-loose (Tree-sitter cross-language). Different jobs — Roslyn for correct C# refactors, CocoIndex for cross-package discovery. Not redundant.

**Effort:** ~1 h to install + index the repo (one-time index ~10 min for this codebase size). Re-indexing is incremental and auto-trigger-able via PostToolUse hook on file write.

**Fit score:** 4/5 — strong token-discipline ROI; soft adoption (sub-agents fall back to grep gracefully).

---

## 5. Git Worktree MCP — automates the epic-branch worktree lifecycle

**What it is:** MCP server (`kingkillery/git-worktree-mcp`) that exposes worktree create/list/rebase/remove as tool calls. Pairs with GitButler if visual branch management is wanted; the MCP itself is CLI-deep.

**Source:** https://github.com/kingkillery/git-worktree-mcp

**Where it slots in:**

`.claude/CLAUDE.md` has explicit rules around `.worktrees/<N>-<short>/`:

- Created off the **epic branch** for sub-issues.
- After a sub-issue merges to the epic branch (rule §8a), all in-flight sibling sub-issue worktrees must be rebased onto the new epic-branch tip.
- After full merge, the worktree must be removed (`git worktree remove`).

Today these steps are bash one-liners the orchestrator runs by hand. The Git Worktree MCP wraps them as structured tool calls with consistent error handling — esp. valuable for the rebase-siblings step (currently no automated check that rebases actually completed cleanly across all siblings).

**Why this project specifically:**

- The epic-branch model is already in `.claude/CLAUDE.md` as the project's distinguishing orchestration choice; tightening its mechanics is high-ROI.
- Recent epics (#65 photo feature, #66, #67 photo-diary) had 5–13 sub-issues each. Sibling-rebase failures on epic #67 caused at least one stale-diff QA round-trip.
- A PostToolUse hook on `gh pr merge` (or pr-reviewer's MERGED return) could auto-trigger sibling rebase via the MCP — turns rule §8a's manual sibling-rebase clause into a hands-off step.

**Effort:** ~30 min to install + write a rebase-siblings recipe. Update `pr-reviewer.md` (sub-issue mode) to call the MCP instead of bash worktree commands.

**Fit score:** 3.5/5 — high-quality hardening of an existing convention, but only worth the install if epics keep coming at the current cadence.

---

## 6. `claude-security-guardrails` — turn the policy-text security baseline into hooks

**What it is:** A community hooks bundle (`mafiaguy/claude-security-guardrails`) of PreToolUse and PostToolUse hooks that block risky operations: force-push variants, `rm -rf` with absolute paths, edits to `.env*` / `appsettings.*.json` / `secrets.json` / `*.pfx`. Includes a small React dashboard for visualising blocked operations.

**Source:** https://github.com/mafiaguy/claude-security-guardrails

**Where it slots in:**

The global `~/.claude/CLAUDE.md` Security Baseline lists exactly the same set of bans:

- `git push --force` / `--force-with-lease` / `-f`
- `git reset --hard`
- `rm -rf` (esp. with absolute paths)
- `dotnet ef database drop`
- Edits to `.env*`, `appsettings.*.json`, `secrets.json`, `*.pfx`, `*.key`

Today these are policy-text. They're respected because Opus reads CLAUDE.md every session, but a sub-agent with a stripped-down prompt or a Haiku scout might miss them. Hooks make them deterministic regardless of which model runs the tool.

**Why this project specifically:**

- The auto-memory line `feedback_kill_be_after_regen.md` shows tool discipline is already a managed concern; a hook layer formalises it.
- The project already has one custom guardrail (`block-generated-edits` PreToolUse on `src/api/generated.ts`) — adding a security-baseline bundle on top is the same pattern.
- Parallel sub-agent dispatch (rule §parallel-sub-agents) is where this matters most: orchestrator can't step in mid-tool-call to remind a sub-agent of the security baseline.

**Trade-off:** Day-2 report's §7 covered HTTP hooks (Anthropic's Feb 2026 feature). This is the *content* of useful hooks, not the hook system itself. Compatible with HTTP hooks if/when those are adopted.

**Effort:** ~20 min to install + cherry-pick the relevant hooks (drop the dashboard component if not wanted). Configure deny lists in `.claude/settings.json` to inherit instead of duplicating.

**Fit score:** 3/5 — good hardening, low cost, but the existing policy-text already works for a single-user setup. Higher value when delegation breadth increases.

---

## What's NOT in this report

Already covered in the prior two:

- Statusline tools (CCometixLine, ccstatusline) — day 1 §1
- OWASP / `claude-code-security-review` GH Action — day 1 §2
- i18n audit skills — day 1 §3
- Expo MCP — day 1 §4 + day 2 §5
- Testcontainers skill — day 1 §5
- Delightful Design System — day 1 §6
- HTTP hooks — day 1 §7
- `cclint` — day 1 §8
- `claude-mem` — day 1 §9
- Hosted Code Review for Claude Code — day 2 §1
- `dotnet-claude-kit` / Roslyn MCP — day 2 §2
- Anthropic Agent Teams — day 2 §3
- `lackeyjb/playwright-skill` — day 2 §4
- `expo-mcp` + `xc-mcp` testID-driven testing — day 2 §5
- `hesreallyhim/awesome-claude-code` registry — day 2 §6

Considered but rejected today:

- **Playwright AI Healer (auto-repair visual regressions)** — slim differentiation vs. `playwright-skill`'s `toHaveScreenshot()` patterns from day 2 §4. Re-evaluate if the project adopts visual baselines first.
- **`rohitg00/awesome-claude-code-toolkit`** — overlaps with day 2's coverage of `hesreallyhim/awesome-claude-code` and `ComposioHQ/awesome-claude-plugins`. Different curation slice but not enough new material to justify its own section.

---

## Suggested execution sequence (delta vs days 1–2)

1. **This week:** Install GitHub MCP server (§1) — direct replacement for an existing manual step in `pr-reviewer`'s merge gate. Update the agent's SKILL.md to prefer the MCP. Lowest risk, highest immediate ROI.
2. **Within next epic cycle:** Pilot a11y skill (§3) on the trainer portal's top 5 routes. Treat findings as a backlog, not as a single big PR.
3. **As a scoped chore issue:** Pact pilot (§2) on 3 high-churn endpoints. If the producer-side gate proves useful, expand on each new endpoint.
4. **Token-discipline experiment:** Spike CocoIndex Code (§4) on the next cross-package issue. If `feature-dev:code-explorer` shows measurable token reduction, adopt project-wide.
5. **Quality-of-life:** Git Worktree MCP (§5) — install when the next epic kicks off. Avoid mid-flight conversion.
6. **Optional hardening:** `claude-security-guardrails` (§6) — install as a second safety net, not a primary defence. Day-1 HTTP hooks remain the canonical hook system.

---

## Sources

- [GitHub MCP server (official)](https://github.com/github/github-mcp-server)
- [GitHub MCP — `tail_lines` parameter (changelog)](https://github.com/github/github-mcp-server/releases)
- [Pact — consumer-driven contract testing](https://docs.pact.io)
- [`pact-foundation/pact-net`](https://github.com/pact-foundation/pact-net)
- [`pact-foundation/pact-js`](https://github.com/pact-foundation/pact-js)
- [`airowe/claude-a11y-skill`](https://github.com/airowe/claude-a11y-skill)
- [axe-core (Deque) — accessibility engine](https://github.com/dequelabs/axe-core)
- [CocoIndex Code](https://cocoindex.io/cocoindex-code/)
- [`cocoindex-io/cocoindex` — repo](https://github.com/cocoindex-io/cocoindex)
- [`kingkillery/git-worktree-mcp`](https://github.com/kingkillery/git-worktree-mcp)
- [`mafiaguy/claude-security-guardrails`](https://github.com/mafiaguy/claude-security-guardrails)
- [Claude Code hooks reference](https://docs.claude.com/en/docs/claude-code/hooks)
