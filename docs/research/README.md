# Claude Code ecosystem surveys

One-shot research artefacts produced by the `daily-researcher` skill
between 2026-04-28 and 2026-05-19. Each file is an as-of-that-date scan of
the Claude Code ecosystem — new skills, MCP servers, hooks, agents, and
plugins — filtered through "would this slot into the GoodFellas
fitness-platform stack?".

## Reading order

Chronological. Earlier entries (Apr 28 – May 05) are the longest and
establish the catalogue baseline; later entries are diffs against the
previous run, so they're shorter and assume context.

| Date | File | Notes |
|---|---|---|
| 2026-04-28 | [`claude-code-ecosystem-additions-2026-04-28.md`](claude-code-ecosystem-additions-2026-04-28.md) | Baseline. Ranked P1 / P2 / P3 recommendation list. |
| 2026-04-29 | [`claude-code-ecosystem-additions-2026-04-29.md`](claude-code-ecosystem-additions-2026-04-29.md) | Day-2 additions. |
| 2026-04-30 | [`claude-code-ecosystem-additions-2026-04-30.md`](claude-code-ecosystem-additions-2026-04-30.md) | |
| 2026-05-01 | [`claude-code-ecosystem-additions-2026-05-01.md`](claude-code-ecosystem-additions-2026-05-01.md) | Spawned tracking issues #190–#198. |
| 2026-05-05 | [`claude-code-ecosystem-additions-2026-05-05.md`](claude-code-ecosystem-additions-2026-05-05.md) | |
| 2026-05-11 | [`claude-code-ecosystem-additions-2026-05-11.md`](claude-code-ecosystem-additions-2026-05-11.md) | |
| 2026-05-13 | [`claude-code-ecosystem-additions-2026-05-13.md`](claude-code-ecosystem-additions-2026-05-13.md) | Diff format — shorter. |
| 2026-05-16 | [`claude-code-ecosystem-additions-2026-05-16.md`](claude-code-ecosystem-additions-2026-05-16.md) | |
| 2026-05-19 | [`claude-code-ecosystem-additions-2026-05-19.md`](claude-code-ecosystem-additions-2026-05-19.md) | Most recent run. |

## Focused evaluations

Distinct from the dated daily-researcher digests above — these are
deliberate evaluation + decision records spawned from a specific tracking
issue, not as-of-date scans:

| Date | File | Issue | Decision |
|---|---|---|---|
| 2026-06-08 | [`agent-teams-vs-ship-epic-evaluation-2026-06-08.md`](agent-teams-vs-ship-epic-evaluation-2026-06-08.md) | [#193](https://github.com/JanProkorat/fitness-platform/issues/193) | Partial adopt — retain `ship-epic`, pilot Agent Teams for review/debug only |

## Source

Produced by [`.claude/skills/daily-researcher/`](../../.claude/skills/daily-researcher/) —
fan-out web search → curated registry sweep → adoption-readiness digest.

## Retention policy

**Historical artefacts.** These are not actively maintained. Items that
graduated to action live elsewhere:

- The P1 / P2 recommendations from 2026-04-28 → either landed as merged
  PRs (Delightful Design System plugin, statusline, OWASP skill) or
  became tracking issues [#190–#198](https://github.com/JanProkorat/fitness-platform/issues?q=is%3Aissue+author%3A%40me+%22ecosystem%22) with explicit triggers.
- The current orchestration source-of-truth lives in
  [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) and
  [`.claude/rules/*.md`](../../.claude/rules/) — not here.

If you want the latest ecosystem snapshot, invoke the
`daily-researcher` skill — don't infer current state from these files.
