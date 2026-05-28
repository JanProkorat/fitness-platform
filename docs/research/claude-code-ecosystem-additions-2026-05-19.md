# Claude Code Ecosystem — Day-3 Check-in

**Compiled:** 2026-05-19 (scheduled `daily-researcher` run, 3 days after prior digest)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)
- [`claude-code-ecosystem-additions-2026-05-01.md`](./claude-code-ecosystem-additions-2026-05-01.md)
- [`claude-code-ecosystem-additions-2026-05-05.md`](./claude-code-ecosystem-additions-2026-05-05.md)
- [`claude-code-ecosystem-additions-2026-05-11.md`](./claude-code-ecosystem-additions-2026-05-11.md)
- [`claude-code-ecosystem-additions-2026-05-13.md`](./claude-code-ecosystem-additions-2026-05-13.md)
- [`claude-code-ecosystem-additions-2026-05-16.md`](./claude-code-ecosystem-additions-2026-05-16.md)

**Scope:** The 3-day window since the 2026-05-16 digest. Carryovers from older digests are not re-covered (see prior digest preambles for full lists). `claudemarketplace.com` dropped from the survey procedure per the 2026-05-16 recommendation — two prior consecutive failures.

---

## Summary

- **Surveyed:** `hesreallyhim/awesome-claude-code` (last commit 2026-04-27, **no movement** in window), `ComposioHQ/awesome-claude-plugins` (last commit 2026-05-01, no May-13-onward merges), `anthropics/claude-code` releases (one new CLI patch: v2.1.144), `anthropics/claude-code/plugins/` tree (last commit 2026-03-12, no movement), `anthropic.com/news` (no Code posts in window — only enterprise partnership announcements). `claudemarketplace.com` skipped.
- **Findings:** 1 total (1 drop-in / 0 wire-up / 0 tracking).
- **Recommended next action:** Auto-upgrade the CLI on next refresh. **Confirm the move to weekly cadence** — fourth consecutive run with 1 cumulative finding.

---

## TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P2 | **Claude Code CLI v2.1.144** (released 2026-05-19) | Three items intersect our orchestrator setup: **(1) `/resume` now lists background sessions** (we routinely fan out `ship-epic` background agents — historically those vanished from the resume picker), **(2) elapsed duration in background subagent completion notifications** (visibility into how long a `qa-tester` or `pr-reviewer` actually took without re-opening the agent view), **(3) `/plugin` panes show "last updated"** — directly enables the plugin-staleness audit we've been deferring. Plus the startup-hang-on-captive-portal fix, which has bitten me twice in cafés. |

Everything else: silent. No new plugins, no new MCPs, no new skills, no new Anthropic blog posts in the window. Same as the 2026-05-13 and 2026-05-16 digests.

---

## docs-infra

### Claude Code CLI v2.1.144

- **Source:** [`anthropics/claude-code` releases](https://github.com/anthropics/claude-code/releases)
- **Last updated:** 2026-05-19
- **Status:** **drop-in** — auto-upgrades on next CLI bump; nothing to wire.
- **Take:**
  - *Line 1:* CLI patch delivering `/resume` support for background sessions, elapsed-time stamps on background subagent completion notifications, a "last updated" column in `/plugin` browse/discover panes, `/model` session-only-by-default (press `d` to set global), the `/extra-usage` → `/usage-credits` rename, and a fix for startup hanging up to 75s behind a captive portal / VPN.
  - *Line 2:* The three relevant bits for this project: (a) **background-session `/resume`** is a real ergonomics improvement — `ship-epic` fan-outs spawn background agents and historically lost them after a `/clear`; now they're indexed alongside interactive sessions; (b) **elapsed duration on background completion notifications** lets the orchestrator log per-agent wall-clock cost without re-attaching, which feeds back into our cost discipline (`CLAUDE.md §Working Principles §6`); (c) **`/plugin` "last updated"** is the missing piece for the plugin-staleness audit — we have 8+ wired plugins (`superpowers`, `Notion`, `slack`, `atlassian`, `pdf-viewer`, `mongodb`, `playwright-skill`, `delightful-design-system`, `feature-dev`, etc.) and "is this still maintained?" was previously a per-plugin GitHub round-trip. The captive-portal startup fix is a quality-of-life win for working off-network.
- **Action:** **skip filing an issue** — auto-upgrade on next CLI refresh. After the upgrade, spend 10 minutes walking the `/plugin` browse pane to find plugins with `last updated` older than 90 days; flag any candidates for `/clear`-and-disable.

---

## Nothing for backend / web / mobile this cycle

No movement on the surfaces that intersect with our code:

- `wshaddix/dotnet-skills`, `dotnet-claude-kit`, Roslyn MCP — unchanged.
- Expo MCP, XcodeBuildMCP — no new releases since the prior survey.
- `playwright-skill`, axe-core / a11y MCP, Delightful Design System — no new releases.
- No new React 19 / TanStack Query / Tailwind 4 skills hit the curated registries.

The four consecutive low-signal runs (2026-05-11 → 2026-05-13 → 2026-05-16 → 2026-05-19) all surfaced exactly one CLI patch and nothing else. The ecosystem has clearly entered a steady state since the April surge.

---

## Honest assessment of this run

Fourth consecutive run that came back with one CLI release and nothing else. The 2026-05-13 and 2026-05-16 digests both recommended moving `daily-researcher` to **weekly cadence (Monday)**; that recommendation now has a clear empirical base — 4 runs × 1 cumulative finding = ~0.25 findings per run. A single weekly run would cover the same surface at ~1/4 the cost.

The schedule rename also surfaced again: the directory is now `daily-researcher` (was `daily-resercher`), but the scheduled task in `~/.claude/scheduled-tasks/` still references the old typo'd name. Worth fixing when the cadence change lands.

---

## Open carryovers from prior digests

These remain unfiled / un-actioned:

1. **`mksglu/context-mode`** (2026-05-11 P1) — direct fit for `ship-epic.json` state-tracking resilience. SessionStart's state-reinjection block today rendered cleanly (28 handoff files listed, no "malformed" warning), so the urgency dropped slightly vs the 2026-05-16 digest — but the underlying brittleness hasn't been fixed, just hasn't fired today. **Still worth a 1-hour spike** when state damage next surfaces.
2. **`alexgreensh/token-optimizer`** (2026-05-11 P1) — **likely obsoleted by** the v2.1.143 plugin-cost panel + v2.1.144 "last updated" column. After the next CLI refresh, walk both panels for 10 minutes; if they jointly cover "which plugin is expensive" + "which plugin is dead," **drop the carryover entirely**.
3. **`pegasi-ai/reins`** (2026-05-11 P2) — **tracking-only**, no change.

---

## Suggested cron change (re-stated)

Move `daily-researcher` from daily to **weekly (Monday)** in
`~/.claude/scheduled-tasks/`. While doing it, fix the directory rename
mismatch — the scheduled task still references the old typo'd
`daily-resercher` name even though the skill folder is now
`daily-researcher`.

Four consecutive daily runs over the 2026-05-11 → 2026-05-19 window have
produced one cumulative actionable finding per ~3-day delta. The
signal-to-cost ratio favors weekly by a factor of ~3-5×.
