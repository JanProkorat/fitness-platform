---
name: daily-resercher
description: Survey what's new in the Claude Code ecosystem — plugins, skills, MCP servers, agents, hooks. Invoke for "daily research run", "weekly claude survey", "what's new in claude code", "new claude plugins", "new MCP servers". Reports back a structured markdown digest grouping findings by adoption-readiness (drop-in / wire-up / tracking-only). Surveys curated registries first and only falls back to broad WebSearch when the curated list is exhausted.
---

# daily-resercher — Claude Code ecosystem survey

Run this when the user asks "what's new in Claude Code", "weekly claude survey",
"any new plugins / skills / MCPs worth looking at?", "daily research run", or
similar.

The output is a **structured markdown digest** the user (or a follow-up
orchestrator pass) can act on directly — file tracking issues, run installs,
dispatch wire-up PRs.

## Why curated registries first

Broad `WebSearch` for "claude code plugin <topic>" returns lots of noise:
abandoned forks, unrelated wrappers, AI-generated link-farm pages. The
curated registries listed below are maintained lists where each item has been
manually vetted at least once. Survey those first and only fall back to broad
search when an explicit topic isn't represented in any of them.

## Sources to survey (in order)

1. **`hesreallyhim/awesome-claude-code`** —
   <https://github.com/hesreallyhim/awesome-claude-code> — community-curated
   list of skills, slash commands, agents, hooks, statuslines, MCPs.
2. **`ComposioHQ/awesome-claude-plugins`** —
   <https://github.com/ComposioHQ/awesome-claude-plugins> — focused on
   plugin marketplace entries with brief reviews.
3. **Anthropic official `claude-code/plugins/`** —
   <https://github.com/anthropics/claude-code> tree under `plugins/` —
   first-party plugins shipped in the Claude Code repo.
4. **`claudemarketplace.com`** —
   <https://claudemarketplace.com> — searchable index of plugins,
   skills, and MCPs with install counts and recent-update timestamps.
5. **Anthropic blog / changelog** —
   <https://www.anthropic.com/news> filtered to Claude Code posts —
   first-party announcements (HTTP hooks, Agent Teams, hosted Code Review,
   etc.).

If the user names a specific topic ("a11y", "i18n", "security", "Roslyn") and
none of the above surface a strong match, then run `WebSearch` with the
**Haiku** model per Working Principles §6 — never with Opus or Sonnet, since
these calls return long-form pages and burn context.

## Survey procedure

1. **Frame the question.** Confirm with the user what bucket they care about
   (general digest, vs. "anything new for X"). If unspecified, default to
   general digest of the last 14 days.
2. **Survey each registry** in the order above, stopping at the first 3–5
   high-value items per registry. Capture:
   - Name + URL
   - One-line description
   - Last-updated date (if visible)
   - Stars / install count (if visible)
3. **Tag each finding** with one of three adoption-readiness buckets:
   - **drop-in** — install + works out of the box; no wire-up needed.
   - **wire-up** — install required, then a small edit in our `.claude/`
     tree to chain it into the right agent / skill / workflow.
   - **tracking-only** — interesting but premature (alpha, missing GA,
     unclear fit). Track the trigger condition for revisiting.
4. **Add a 2-line take** per finding: line 1 says what it does, line 2 says
   why we'd (or wouldn't) want it.
5. **Propose an action** per finding:
   - drop-in / wire-up → "file a sub-issue under epic #N to install + wire"
   - tracking-only → "add to deferred list in epic #N with trigger `<X>`"
6. **Group by package surface** — backend, web, mobile, docs-infra, all-up —
   so the user can scan by where the impact lands.
7. **Sanity-check** at least one finding against the running repo: does the
   project actually need this? Don't propose tooling for problems we don't
   have.

## Output format

```markdown
# Claude Code ecosystem digest — <YYYY-MM-DD>

## Summary
- Surveyed: <list registries hit>
- Findings: <N total> (<X drop-in> / <Y wire-up> / <Z tracking>)
- Recommended next action: <one sentence>

## docs-infra
### <Item name>
- **Source:** <URL>
- **Status:** drop-in | wire-up | tracking-only
- **Take:** <line 1: what it does>. <line 2: why we want it / don't>.
- **Action:** <file sub-issue / track in epic / skip>

## backend
### <Item name>
…

## web
### <Item name>
…

## mobile
### <Item name>
…
```

Sections with no findings can be omitted.

## When NOT to run

- The user is asking for help on a specific implementation problem — that's a
  task for the relevant dev sub-agent, not a survey.
- The user is asking about a *specific* tool they've already named — go
  straight to fetching its docs (`mcp__plugin_context7_context7__query-docs`
  or the tool's GitHub README), don't run the broader survey.
- Less than 14 days since the last digest unless the user explicitly asks for
  a fresh run — most ecosystem items don't change daily.

## After running

If any findings produced "file a sub-issue" actions, hand off to
`github-issues` with the extracted facts (one paragraph per finding).
Don't paste the full digest into the github-issues prompt — it's expensive
and most of the digest is context the agent doesn't need.
