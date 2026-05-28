# Claude Code Ecosystem — Day-2 Check-in

**Compiled:** 2026-05-13 (scheduled `daily-resercher` run, 2 days after prior digest)
**Companions:**
- [`claude-code-ecosystem-additions-2026-04-28.md`](./claude-code-ecosystem-additions-2026-04-28.md)
- [`claude-code-ecosystem-additions-2026-04-29.md`](./claude-code-ecosystem-additions-2026-04-29.md)
- [`claude-code-ecosystem-additions-2026-04-30.md`](./claude-code-ecosystem-additions-2026-04-30.md)
- [`claude-code-ecosystem-additions-2026-05-01.md`](./claude-code-ecosystem-additions-2026-05-01.md)
- [`claude-code-ecosystem-additions-2026-05-05.md`](./claude-code-ecosystem-additions-2026-05-05.md)
- [`claude-code-ecosystem-additions-2026-05-11.md`](./claude-code-ecosystem-additions-2026-05-11.md)

**Scope:** The 2-day window since the 2026-05-11 digest. Short interval, narrow surface — the registry survey came back almost empty. Anything previously covered (full list in the 2026-05-11 digest's preamble) is **not** re-covered here.

---

## Summary

- **Surveyed:** `hesreallyhim/awesome-claude-code` (no commits since 2026-04-27), `ComposioHQ/awesome-claude-plugins` (no additions post-2026-05-11), `anthropics/claude-code/plugins/` (no new folders), `anthropic.com/news` (no Code posts since 2026-04-17). `claudemarketplace.com` was unreachable during this scout (connection refused) — flagged for retry next run.
- **Findings:** 1 total (1 drop-in / 0 wire-up / 0 tracking).
- **Recommended next action:** Auto-upgrade the CLI when convenient and rerun the scout on 2026-05-18+ when community cadence typically resumes after the weekend lull.

---

## TL;DR — what's new today

| Priority | Addition | Why it matters here |
|---|---|---|
| P3 | **Claude Code CLI v2.1.140** — maintenance release (2026-05-13) | One concrete win for our `.claude/` setup: settings hot-reload fix for **symlinked files**. Several of our `.claude/settings.json` entries and hook paths resolve through symlinks during local testing; this regression-bin was real. Plus case-insensitive agent tool matching and a `/goal` hang fix. |

Everything else: silent. No new plugins, no new MCPs, no new skills, no new Anthropic blog posts in the window.

---

## docs-infra

### Claude Code CLI v2.1.140

- **Source:** [Releasebot — Claude Code updates](https://releasebot.io/updates/anthropic/claude-code) (canonical changelog also at the Claude Code release page).
- **Status:** **drop-in** — auto-upgrades on next CLI bump; nothing to wire.
- **Take:**
  - *Line 1:* Maintenance release: case-insensitive agent tool matching, `/goal` hang fix, settings hot-reload fix for symlinked files, background service startup hardening.
  - *Line 2:* The symlinked-settings hot-reload fix is the bit that touches us — when `~/.claude/settings.json` or the project `.claude/settings.json` is symlinked (we do this for the cross-project hooks layer), prior versions could miss reloads after edits. Nothing else in the release rewrites our workflow.
- **Action:** **skip filing an issue** — auto-upgrade on next CLI refresh. If anyone hits a hot-reload misfire on `.claude/settings.json` in the next few days, refer them to this version.

---

## Nothing for backend / web / mobile this cycle

No movement on:

- `wshaddix/dotnet-skills`, `dotnet-claude-kit`, Roslyn MCP — all unchanged.
- Expo MCP, XcodeBuildMCP — no new releases.
- `playwright-skill`, axe-core / a11y MCP, Delightful Design System — no new releases.

The 2026-05-11 P1 candidates (`mksglu/context-mode`, `alexgreensh/token-optimizer`) are still the unfinished business worth attention from that digest if anyone has spare cycles — neither has been actioned yet and both target real pain points (state-file durability, session-start token bloat).

---

## Honest assessment of this run

A 2-day cadence is too tight for ecosystem surveys — most registries don't see daily churn. The schedule was set to "daily" but the realistic signal cadence is more like every 5–7 days. **Suggestion for the user:** consider relaxing the `daily-resercher` cron to ~weekly (Monday + Thursday, or weekly Monday). Current run found 1 minor item over 2 days; the 2026-05-11 run found 6 items over 6 days. The hit-rate per run improves dramatically with the longer interval, and the total tokens spent per week drops.

A second consideration: `claudemarketplace.com` failed to load during this scout — if it's still down on the next run, the survey should fall back to its mirror on `claudemarketplace.com/sitemap.xml` or skip that source entirely with a noted exclusion.

---

## Open carryovers from prior digests

These remain unfiled / un-actioned:

1. **`mksglu/context-mode`** (2026-05-11 P1) — direct fit for our `ship-epic.json` state-tracking. The SessionStart sentinel on 2026-05-13 ("ship-epic state malformed") confirmed the failure surface is still live. Worth a 1-hour install-in-observer-mode spike.
2. **`alexgreensh/token-optimizer`** (2026-05-11 P1) — single-pass audit of what's eating session-start tokens. Our `.claude/` tree grew again this week (training-sections sub-issues, fresh hook additions). One audit run + prune pass is a high-ROI 30-minute task.
3. **`pegasi-ai/reins`** (2026-05-11 P2) — only worth it if our two custom Bash hooks (`deny-subagent-merge`, `agent-bash-allowlist`) start missing real violations. They haven't. **Tracking-only.**

If any of (1) or (2) come up next time the user is between epics, they're worth surfacing.
