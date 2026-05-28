# Claude Code Ecosystem — Day-3 Check-in

**Compiled:** 2026-05-16 (scheduled `daily-resercher` run, 3 days after prior digest)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)
- [`claude-code-ecosystem-additions-2026-05-01.md`](./claude-code-ecosystem-additions-2026-05-01.md)
- [`claude-code-ecosystem-additions-2026-05-05.md`](./claude-code-ecosystem-additions-2026-05-05.md)
- [`claude-code-ecosystem-additions-2026-05-11.md`](./claude-code-ecosystem-additions-2026-05-11.md)
- [`claude-code-ecosystem-additions-2026-05-13.md`](./claude-code-ecosystem-additions-2026-05-13.md)

**Scope:** The 3-day window since the 2026-05-13 digest. Carryovers from older digests are not re-covered (see prior digest preambles for full lists). Scout work delegated to a Haiku-backed `general-purpose` sub-agent per Working Principles §6.

---

## Summary

- **Surveyed:** `hesreallyhim/awesome-claude-code` (last commit 2026-04-27, no movement), `ComposioHQ/awesome-claude-plugins` (no May merges), `anthropics/claude-code` releases (three new CLI patches: v2.1.141 → v2.1.143), `claudemarketplace.com` (still unreachable — `ECONNREFUSED`, **second consecutive failure**), `anthropic.com/news` (no Code posts in window).
- **Findings:** 1 total (1 drop-in / 0 wire-up / 0 tracking).
- **Recommended next action:** Auto-upgrade the CLI on next refresh. Drop `claudemarketplace.com` from the survey procedure until it's confirmed back up — two failed runs in a row.

---

## TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P3 | **Claude Code CLI v2.1.141 → v2.1.143** — three patch releases (2026-05-13 → 2026-05-15) | Two items touch our setup: **plugin dependency enforcement** (transitive enable/disable chains across the 8+ plugins we have wired) and **projected context-cost display in the marketplace** (visibility into which installed plugins are eating session-start tokens — directly addresses the unresolved `token-optimizer` carryover). Plus ~20 bug fixes including credential-corruption hang, `/loop` wakeup, agent-view spawn storms, and background-session file capture. |

Everything else: silent. No new plugins, no new MCPs, no new skills, no new Anthropic blog posts in the window.

---

## docs-infra

### Claude Code CLI v2.1.141–143

- **Source:** [`anthropics/claude-code` releases](https://github.com/anthropics/claude-code/releases)
- **Last updated:** 2026-05-15 (v2.1.143)
- **Status:** **drop-in** — auto-upgrades on next CLI bump; nothing to wire.
- **Take:**
  - *Line 1:* Three patch releases delivering plugin dependency enforcement (transitive enable/disable), projected context-cost display in the plugin marketplace, the new `worktree.bgIsolation` mode (direct working-copy edits without spinning `EnterWorktree`), and ~20 stability fixes (credential corruption, PowerShell exec-policy, `/loop` wakeup, agent-view spawn storms, background-session file capture, macOS Full Disk Access).
  - *Line 2:* The two relevant bits for this project: (a) dependency enforcement matters because we have 8+ plugins wired (`superpowers`, `Notion`, `slack`, `atlassian`, `pdf-viewer`, `mongodb`, `playwright-skill`, etc.) and the transitive chain is easy to mis-configure; (b) cost projection in the marketplace finally gives us the **session-start token visibility** the open `alexgreensh/token-optimizer` carryover was meant to address — we may not need a third-party plugin for that audit anymore. `worktree.bgIsolation` is niche — we use worktrees correctly per the epic-branch model, so low immediate value.
- **Action:** **skip filing an issue** — auto-upgrade on next CLI refresh. Worth a 5-minute look at the new plugin-cost panel after the upgrade to confirm it covers what `token-optimizer` would have done; if it does, the carryover can be dropped from the deferred list.

---

## Nothing for backend / web / mobile this cycle

No movement on the surfaces that intersect with our code:

- `wshaddix/dotnet-skills`, `dotnet-claude-kit`, Roslyn MCP — unchanged.
- Expo MCP, XcodeBuildMCP — no new releases.
- `playwright-skill`, axe-core / a11y MCP, Delightful Design System — no new releases.
- No new React 19 / TanStack Query / Tailwind 4 skills hit the curated registries.

---

## Honest assessment of this run

Third consecutive run that came back with one CLI release and nothing else. The 2026-05-13 digest's recommendation — relax `daily-resercher` to a weekly cadence (Monday, or Monday + Thursday) — still stands. Three daily runs over the 2026-05-13 → 2026-05-16 window produced one cumulative finding that would have surfaced just as well in a single weekly run.

`claudemarketplace.com` has now failed two runs in a row. Recommend removing it from the survey procedure in `daily-resercher/SKILL.md` until it's confirmed back online, otherwise we keep paying the WebFetch round-trip for a guaranteed timeout.

---

## Open carryovers from prior digests

These remain unfiled / un-actioned:

1. **`mksglu/context-mode`** (2026-05-11 P1) — direct fit for our `ship-epic.json` state-tracking. The SessionStart sentinel today still flagged `ship-epic state malformed` — the failure surface is **still live three days later**. This is increasingly worth a 1-hour install-in-observer-mode spike.
2. **`alexgreensh/token-optimizer`** (2026-05-11 P1) — **may be obsoleted by** the new CLI v2.1.143 plugin-cost panel. Re-evaluate after the CLI upgrade lands; if the built-in panel breaks the spending down by plugin/skill, this third-party tool no longer adds value.
3. **`pegasi-ai/reins`** (2026-05-11 P2) — **tracking-only**, no change.

The `ship-epic` state issue (carryover #1) deserves a real fix soon — it's now been flagged in three consecutive SessionStart hooks. Either install `context-mode` for resilience or have the orchestrator add an automatic `state/ship-epic.json` repair pass when malformed JSON is detected.

---

## Suggested cron change

Move `daily-resercher` from daily to **weekly (Monday)**. Three consecutive daily runs have produced one cumulative actionable finding — the per-run signal density is roughly 1/3 of what a 7-day window would produce, and the token cost per week would drop ~5×.
