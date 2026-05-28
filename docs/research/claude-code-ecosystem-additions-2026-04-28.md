# Claude Code Ecosystem — Additions Worth Considering

**Compiled:** 2026-04-28 (scheduled `daily-resercher` run)
**Scope:** New skills, agents, hooks, MCP servers, and plugins released or matured by Apr 2026 that map to the GoodFellas fitness-platform stack (.NET 10 backend / React 19 web / Expo SDK 55 mobile) and its existing orchestration setup.
**Filter applied:** anything that already overlaps with the project's `.claude/agents/`, `.claude/skills/`, or installed plugins is omitted. Each entry below names a concrete way it would slot into the *current* orchestration — not a generic pitch.

---

## 0. TL;DR — recommended adds, ranked

| Priority | Addition | Why it fits *this* project |
|---|---|---|
| P1 | **Statusline plugin** (CCometixLine or ccstatusline) | Long orchestrator sessions; today there's no in-terminal signal for context %, token spend, or active branch. Pure visibility gain, zero workflow risk. |
| P1 | **OWASP / Agentic AI security skill** + Anthropic's `claude-code-security-review` GH Action | Auth, invite, upload, and ownership endpoints are the riskiest surfaces. Formalises the `gc-sec-review` chainable mention into an automatic pre-merge gate. |
| P1 | **i18n audit skill** (`i18n-expert` / `i18n-scan`) | cs/en/de parity is *already* an AC failure for `qa-tester`; a dedicated pre-QA scan would catch missing keys earlier and avoid round-trip churn. |
| P2 | **Expo official remote MCP** | Adds Expo-SDK-aware doc/tool calls (current setup leans on `xcodebuildmcp` for the simulator path; Expo MCP would cover SDK 55 questions, native module guidance). |
| P2 | **Testcontainers Claude skill** (`testcontainers/claude-skills`) | Backend tests already use Testcontainers — dedicated patterns would tighten `fe-endpoint`-generated test scaffolding around lifecycle, parallelism, and `.WithReuse()`. |
| P2 | **Delightful Design System plugin** (token compliance scan) | Direct match for the project's hardcoded-color/spacing ban. Could become a `PreToolUse` hook on `web/**` and `mobile/**` Edits. |
| P3 | **HTTP hooks** (Feb 2026 feature) | Replaces shell hooks with HTTP POSTs — opens the door to Slack/CI integrations without spawning processes per tool call. |
| P3 | **`cclint`** (linter for `.claude/` files) | The repo's `.claude/` tree is now non-trivial (workflow agents, dev agents, ~13 skills). A lint pass on frontmatter + YAML would prevent silent agent-config bitrot. |
| P3 | **`claude-mem` long-term memory** | Beyond the per-session `.remember/` buffer, `claude-mem` carries decisions across days/weeks. The project already keeps `today-*.md` daily logs — `claude-mem` would auto-promote durable preferences. |

The deliberate **non-recommendations** (skills/plugins this project already has equivalents of) are listed at the bottom.

---

## 1. Statusline — context/budget visibility

**What it is:** A custom statusline replaces the bottom bar in Claude Code with live data: model name, working directory, git branch + dirty state, context-window %, token usage, cost, and (with OAuth) subscription rate-limit headroom.

The two leading 2026 implementations are:

- **CCometixLine** (Rust) — model, dir, git status, context % with transcript-based tracking.
- **ccstatusline** (Node) — modular widgets including separate counts for staged / unstaged / untracked files, deduped streaming token counts.

**Where it slots in:** Pure overlay — no agent or hook impact. Configured via `~/.claude/settings.json` `statusLine` block (or `/statusline` natural-language config).

**Why this project specifically:**
- Orchestrator sessions on this repo regularly stack `ship-epic` → multiple parallel sub-issue dispatches → `qa-tester` → `pr-reviewer` rounds. Token spend is invisible today.
- The epic-branch model means worktree branches change underfoot (`.worktrees/<N>-<short>/feature/<N>-<short>`). A branch widget removes "wait, which checkout am I in?" footguns.
- Cost is a real concern with Opus 4.7 + 1M context; surfacing remaining budget per session feeds back into the "plan-then-execute for large tasks" rule (Working Principles §5).

**Effort:** ~10 minutes. Low risk.

---

## 2. Security review — OWASP skill + GH Action

**What it is:** Two complementary pieces:

1. **`agamm/claude-code-owasp` skill** — bundles OWASP Top 10 (2025), ASVS 5.0, and the new **OWASP Agentic AI Top 10** (2026) as a Claude Code skill. Auto-activates on auth, upload, invitation, or AI-tool-call code-review prompts.
2. **`anthropics/claude-code-security-review`** — official Anthropic GitHub Action that runs Claude as a security reviewer on every PR diff. Designed to find what static SAST tools miss: missing controls, business-logic flaws, attack-path chaining.

Adjacent: `SecOpsAgentKit` ships 25+ skills including `secrets-gitleaks` for hardcoded-secret detection.

**Where it slots in:**
- The orchestrator's `.claude/CLAUDE.md` already references `gc-sec-review` as a chainable plugin skill, but it's optional today. Promoting it to **mandatory for any PR whose diff touches `Features/Auth/`, `Features/Client/Invites/`, `Features/Trainers/Clients/`, or any blob-upload path** would close a concrete gap.
- `pr-reviewer` runs a two-pass review; the security skill would be invoked inside the first pass when scope-tags include `auth`, `invite`, `upload`, or `ownership`.
- The GH Action is independent — it runs in CI alongside the existing review and surfaces findings on the PR. Backstops `pr-reviewer` for cases where the orchestrator skipped a sec-review chain.

**Why this project specifically:**
- The platform brokers trainer↔client relationships. Recent work (epic #67 photo-diary requests, PR #149 GuidSerializer, blob 403 fixes) all touched auth/ownership boundaries.
- MinIO public-read is now the default for some assets (per `archive.md`). Anything touching ACL paths benefits from a structured audit.
- The OWASP **Agentic** Top 10 specifically covers tool-calling agents — directly relevant since the trainer/client app uses SignalR + AI features.

**Effort:** ~30 min for the skill, ~15 min for the GH Action workflow. The Action is gated on a Claude API key; project already has Anthropic creds via Claude Code so this is just env wiring in CI.

---

## 3. i18n audit — proactive translation parity

**What it is:** A skill family for finding hardcoded strings, extracting them to locale files, and reporting parity gaps. Concrete options:

- **`i18n-expert`** — runs `i18n_audit.py`, comparing `t('key')` usage against locale JSON files; reports missing/orphaned keys per locale.
- **`i18n-scan`** — finds hardcoded JSX text, string literals in user-facing contexts, and placeholder text that should be `t()`-wrapped.
- **`i18n-extract`** — actually rewrites the code to wrap and extract.

**Where it slots in:**
- Today the i18n parity check happens *inside* `qa-tester` per the AC gate — meaning a missing German key forces a full dev → qa round-trip.
- A pre-QA `i18n-audit` invocation inside `web-react` and `mobile-expo` (right after their work, before they hand back) would catch parity gaps in-package.
- For new web pages and mobile screens, this can chain inside `web-page` and `mobile-screen` skills as a final step.

**Why this project specifically:**
- cs/en/de is mandated across all three packages (`/web/src/i18n/`, `/mobile/src/i18n/`, backend FluentValidation messages where applicable).
- Recent activity (`recent.md`) shows back-to-back i18n adds (auth flow, "FOTKY DNE", `common.delete*`); a parity scan would have caught the inevitable misses earlier.

**Effort:** ~20 min. Low risk — the skill is read-only by default; only `i18n-extract` mode mutates.

---

## 4. Expo official MCP server

**What it is:** A remote MCP server hosted by Expo (https://docs.expo.dev/eas/ai/mcp/) that exposes:

- **Server capabilities** (no local server needed): `search_documentation` over the Expo SDK + EAS docs.
- **Local capabilities** (requires `expo start`): interact with simulators, drive React Native DevTools, inspect network/components/state.

**Where it slots in:**
- The project's mobile work currently relies on `xcodebuildmcp` for the *iOS Simulator* and on memorised Expo SDK 55 conventions for everything else.
- Adding the Expo MCP gives `mobile-expo` and `qa-tester` first-class access to up-to-date Expo SDK 55 docs (and any future SDK bump) without WebFetch detours.
- Local-capability mode replicates parts of `xcodebuildmcp` (component inspection) but with cross-platform reach (Android emulator support).

**Why this project specifically:**
- SDK 55 is current; the project will inevitably need to evaluate SDK 56 / Expo Router v4 / new architecture migrations. Doc lookups via MCP > stale training data.
- `xcodebuildmcp` is iOS-only by design. Android coverage is a known blind spot — Expo MCP closes part of it.

**Effort:** ~5 min (remote MCP — just add the URL + token to `.mcp.json` or `~/.claude/mcp.json`).

---

## 5. Testcontainers Claude skill

**What it is:** `testcontainers/claude-skills` — official skills for designing, running, and debugging Testcontainers-based integration tests. Covers lifecycle (`.WithReuse()`, container caching), parallel-friendly patterns, and the .NET-specific module pack (PostgreSQL, MongoDB, MinIO, Redis, Localstack — 65+ modules).

**Where it slots in:**
- `backend-dotnet` and the `fe-endpoint` skill already produce Testcontainers tests, but the patterns are baked into the skill's own template. Centralising them on the upstream skill (which tracks Testcontainers releases) means fewer drift bugs.
- Could chain inside `fe-endpoint` as the test-scaffolding step.

**Why this project specifically:**
- `FitnessApiFactory.cs` is the central Testcontainers harness; it now has 884+ tests behind it. Any future change to that fixture has wide blast radius.
- Recent work on PR #149 tripped over a `GuidSerializer` Mongo registration race that the official skill has documented patterns for ([ModuleInitializer] on bootstrap, exactly the fix that landed).

**Effort:** ~10 min to install. Low risk — read-mostly.

---

## 6. Delightful Design System plugin (token compliance scan)

**What it is:** `kylesnav/delightful-claude-plugin` — a design-system plugin with a *compliance scan* skill that detects:

- Hardcoded color/spacing/font values when tokens exist.
- Missing interaction states (hover/focus/active/disabled).
- Accessibility gaps (contrast, touch-target, label).
- Dark-mode breakage.

**Where it slots in:**
- The project explicitly bans hardcoded colors/spacing/fonts in `/web` and `/mobile` (see `CLAUDE.md` §"What NOT to Do" and §"Hardcoded-value bans").
- Could be wired as a **`PreToolUse` hook** on `Edit`/`Write`/`MultiEdit` against `web/src/**` and `mobile/**` — analogous to the existing `block-generated-edits` hook on `generated.ts`.
- Alternatively, run as a final-pass skill inside `web-react`/`mobile-expo` before they declare done.

**Why this project specifically:**
- The recent palette unification (`Brand.gold`, `Colors.shadow` consts, 31-file cleanup) was a manual sweep. A scan-on-edit hook would prevent re-introductions.
- Mobile-side `useTheme()` discipline is enforced today only by code review — automated check is cheaper.

**Effort:** ~30 min if installed as a skill; ~1 h if formalised as a hook with a scoped allowlist (e.g. allow hardcoded values inside `constants/colors.ts`, `tailwind.config.ts`, design-token files only).

---

## 7. HTTP hooks (Feb 2026 feature)

**What it is:** A new hook transport that POSTs JSON to an HTTP endpoint and consumes the JSON response, in addition to the existing shell-command hooks. Lets you wire hooks to:

- Internal CI / status APIs without spawning processes per tool call.
- Slack incoming webhooks (the project already uses Slack OAuth for PR alerts).
- Bespoke microservices (a self-hosted "review-gate" endpoint, for example).

**Where it slots in:**
- Replaces the shell-out from the (currently shell-based) SessionStart memory hook with an HTTP version that could pull live state from a central hub if the project ever centralises logs.
- A `Stop` HTTP hook → Slack channel for "session ended on epic-branch <X> with N modified files" — handy for AFK orchestration days.

**Why this project specifically:**
- The existing Slack-OAuth → PR-alerts pipeline is documented in `archive.md`; HTTP hooks would let the orchestrator post turn-end summaries without a separate `mcp__slack_*` call.
- Lower latency than the shell-fork model on long sessions.

**Effort:** ~30 min for a Slack-end-of-turn webhook. Skip until there's a concrete handler to point at.

---

## 8. `cclint` — linter for `.claude/` files

**What it is:** A standalone CLI (`carlrannaberg/cclint`) that lints Claude Code config files: agent frontmatter, skill YAML, MCP config, hook command syntax, `settings.json` schema. Catches typos in `subagent_type`, broken `Skill` references, malformed `permissions` blocks.

**Where it slots in:**
- Add as a `pre-commit` hook (the project already uses pre-commit hooks per `CLAUDE.md`).
- Run in CI on PRs that touch `.claude/**`.

**Why this project specifically:**
- `.claude/` is no longer trivial: 3 dev sub-agents, 3 workflow sub-agents, ~13 project skills, the orchestrator CLAUDE.md, hooks, MCP config. A typo in any frontmatter today fails *silently* — the agent just isn't dispatched.
- The recent epic dispatch model (`ship-epic`) hard-codes agent names; a lint catch on a renamed agent would prevent a confusing mid-epic failure.

**Effort:** ~15 min. Low risk — read-only linter.

---

## 9. `claude-mem` — long-term cross-session memory

**What it is:** A plugin that adds persistent long-term memory for Claude Code, beyond the per-session/per-day buffer. Memories survive context compaction and session boundaries; relevant ones are auto-injected on session start.

**Where it slots in:**
- Complements the existing `.remember/` daily/recent/archive buffers and the `~/.claude/projects/.../memory/` user-feedback memory store.
- Where `.remember/` is *project state* and `memory/` is *user preferences*, `claude-mem` would carry **architectural decisions and ongoing context** (e.g. "epic #67 deferred Wave-3 web work to a follow-up — see `docs/notion`") across days without manual archive curation.

**Why this project specifically:**
- The current `today-*.md` daily logs are written by hand at session-end and grow stale fast (see `archive.md` — last entry is week of 2026-04-20).
- Multi-day epics (#67 currently) span sessions; orchestrator state is currently re-derived from GitHub each new session.

**Effort:** ~20 min. Some risk of context bloat — should be configured with a tight memory budget.

**Caveat:** Overlaps philosophically with the project's existing memory system. Worth a *trial only*, not a default-on rollout.

---

## 10. Honourable mentions (lower-fit but worth noting)

- **`context-mode` plugin** (98% context savings via sandboxed subprocess summarisation) — claims to dramatically extend session lifetime. Likely overlaps with the project's existing sub-agent isolation pattern; could conflict with `qa-tester` / `pr-reviewer` which intentionally consume large diffs. *Verdict: skip; the orchestration already factors heavy work into sub-agents.*
- **`metro-mcp`** — third-party React Native MCP for component inspection without app-code changes. Useful but already partially covered by Expo MCP + xcodebuildmcp. *Verdict: revisit only if Expo MCP gaps emerge.*
- **MongoDB official agent skills** — already wired in this project's installed plugins (`plugin:mongodb:mongodb`, `mongodb-query-optimizer`, `mongodb-schema-design`, etc.). *Verdict: already present; nothing to add.*
- **Aaronontheweb/dotnet-skills** (30 .NET skills, 5 specialised agents) — the closest analogue to the project's `backend-dotnet` agent. *Verdict: cherry-pick patterns; don't install wholesale — would conflict with `fe-endpoint` and `mongo-document` skills already tuned to this codebase.*

---

## What NOT to add (to avoid duplication)

- **`superpowers:brainstorming`, `:test-driven-development`, `:executing-plans`** — already in installed plugins; the orchestrator references them via the plan-then-execute rule.
- **Generic ".NET expert" or "React expert" subagents** (VoltAgent / 0xfurai) — the project's `backend-dotnet`, `web-react`, `mobile-expo` are already package-tuned with the project's exact conventions.
- **Generic "code-review" agents** — `pr-reviewer` + the `review` skill + `pr-review-toolkit:*` agents already cover this with the project's specific gate logic.
- **Notion-doc skills (third-party)** — the project's `notion-docs` skill is already incremental-aware with bootstrap/update modes.
- **Slack helper skills** (channel digest, draft announcement) — already in installed plugins.

---

## Suggested execution sequence

If only one rollout window is available:

1. **This week (low-effort, immediate value):**
   Install a statusline (CCometixLine recommended for Rust speed) and `cclint`. Total time: <30 min.

2. **Within the epic #67 cycle (defensive):**
   Add the OWASP skill + the GitHub Action. Wire the OWASP skill into `pr-reviewer`'s first-pass for any PR with `scope:backend` + a touched file under `Features/Auth/` or any `Features/*/Photo*`.

3. **Pre-merge of epic #67 (UX-quality):**
   Install the i18n-expert skill and chain it into `web-page` and `mobile-screen`. Adds ~10s per scaffold; saves a `qa-tester` round-trip per missing-key.

4. **Next quarter (infrastructure):**
   Trial `claude-mem` on a single multi-day epic. Evaluate vs the existing `.remember/` setup. Keep only one source of truth for cross-session memory.

5. **When a concrete handler exists:**
   Migrate the SessionStart memory hook (and any future Slack-on-stop hook) to HTTP hooks.

---

## Sources

- [GitHub – ComposioHQ/awesome-claude-plugins (registry of curated plugins)](https://github.com/ComposioHQ/awesome-claude-plugins)
- [Top 10 Claude Code Plugins to Try in 2026 (Firecrawl blog)](https://www.firecrawl.dev/blog/best-claude-code-plugins)
- [Claude Code Hooks: All 12 Events with Examples (Pixelmojo, 2026)](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns)
- [Claude Code hooks — practical guide (eesel AI, 2026)](https://www.eesel.ai/blog/hooks-in-claude-code)
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline)
- [GitHub – Haleclipse/CCometixLine (Rust statusline)](https://github.com/Haleclipse/CCometixLine)
- [GitHub – sirmalloc/ccstatusline (Node statusline)](https://github.com/sirmalloc/ccstatusline)
- [GitHub – agamm/claude-code-owasp (OWASP skill, includes Agentic AI Top 10)](https://github.com/agamm/claude-code-owasp)
- [GitHub – anthropics/claude-code-security-review (official GH Action)](https://github.com/anthropics/claude-code-security-review)
- [OWASP Agentic Skills Top 10 (2026)](https://owasp.org/www-project-agentic-skills-top-10/)
- [GitHub – AgentSecOps/SecOpsAgentKit (25+ security skills incl. secrets-gitleaks)](https://github.com/AgentSecOps/SecOpsAgentKit)
- [i18n-expert skill (explainx.ai)](https://explainx.ai/skills/daymade/claude-code-skills/i18n-expert)
- [Claude Code Skills i18n 2026 (intlpull.com)](https://intlpull.com/blog/claude-code-skills-i18n-automation-2026)
- [Create an i18n specialist with Claude Code subagents (Jökull Sólberg)](https://www.solberg.is/i18n-subagent)
- [Using Model Context Protocol (MCP) with Expo — Expo Docs](https://docs.expo.dev/eas/ai/mcp/)
- [GitHub – senaiverse/claude-code-reactnative-expo-agent-system](https://github.com/senaiverse/claude-code-reactnative-expo-agent-system)
- [GitHub – testcontainers/claude-skills](https://github.com/testcontainers/claude-skills)
- [GitHub – Aaronontheweb/dotnet-skills](https://github.com/Aaronontheweb/dotnet-skills)
- [GitHub – kylesnav/delightful-claude-plugin (design-system compliance)](https://github.com/kylesnav/delightful-claude-plugin)
- [GitHub – carlrannaberg/cclint (linter for `.claude/` files)](https://github.com/carlrannaberg/cclint)
- [Claude Code Sub-Agent For .NET and Angular Development (Atomic Object)](https://spin.atomicobject.com/claude-code-sub-agent/)
- [CLAUDE.md for .NET Developers (codewithmukesh)](https://codewithmukesh.com/blog/claude-md-mastery-dotnet/)
- [Claude Code: Hooks, Subagents, and Skills — Complete Guide (ofox.ai)](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/)
- [Parallel Agentic Development With Git Worktrees (MindStudio)](https://www.mindstudio.ai/blog/parallel-agentic-development-git-worktrees)
- [Claude Skills Marketplace (BrightCoding, 2026-04-26)](https://www.blog.brightcoding.dev/2026/04/26/claude-skills-marketplace-the-essential-plugin-hub-for-developers)
