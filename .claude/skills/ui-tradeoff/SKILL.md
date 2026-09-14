---
name: ui-tradeoff
description: Enforce two-attempt stop rule (Working Principles §4) when an animation / layout / state-sync behavior has failed twice on a surface. Produces a tradeoff doc; demands a screen recording before attempt #3.
---

# ui-tradeoff — stop and rethink before attempt #3

Use this skill the moment a UI iteration loop is about to spiral. Working
Principles §4 bans a third blind attempt at the same behaviour — this skill
is the forcing function that keeps the ban honest.

Concrete triggers (any one of these):

- User has said "it does not work", "still broken", "still wrong", or equivalent
  about the **same surface** twice in a row.
- Two consecutive attempts at the same animation / layout / state-sync
  behaviour have failed (even if the user phrased it politely).
- You, as Claude, are about to try a **third** distinct approach to the same
  behaviour within the same session.
- The behaviour involves timing, gesture handling, or cross-component
  synchronization where a written diff cannot prove it works.

## What this skill does NOT do

- Does not write UI code for you.
- Does not pick the "right" approach — it forces a documented choice.
- Does not replace a screen recording — it **demands** one.

## Before you start the doc

Collect from the session (or ask the user if missing):

1. **Surface** — which component/screen and which behaviour, stated precisely.
   Examples: "Expand/collapse of a list card's children on the overview
   screen", "Completion-state sync between a checkbox tap and the aggregate
   progress bar on the summary view", "Input bar avoiding the on-screen
   keyboard on one platform only".
2. **What 'done' looks like** — the acceptance criterion, in one sentence.
   Example: "Tapping the card header expands it smoothly over ~200ms, measured
   once, with no content flash and no jump on mount".
3. **Implementation context** — what's already used on this surface (whatever
   animation/layout primitive, transition system, or state-management
   mechanism is already in the file) and what's used elsewhere in the same
   codebase for comparable behaviour. Pick from what's already a dependency —
   adopting a new library or primitive is a separate decision, not a rescue
   attempt.

## Produce the doc

Write to `docs/ui-tradeoffs/<YYYY-MM-DD>-<short-kebab-desc>.md`
(create the folder on first use). The file name must be searchable later
when the same class of bug recurs — include the surface, e.g.
`2026-04-22-expand-collapse-list-card.md`.

Use this exact structure — do not skip sections, even if they feel
obvious:

```markdown
# UI Tradeoff — <Surface>

**Date:** <YYYY-MM-DD>
**Session origin:** <issue number or short task description>
**Invoker:** ui-tradeoff skill (Working Principles §4)

## 1. What 'done' looks like

<One sentence. Measurable. E.g. "Card header tap smoothly expands children
over ~200ms with no content flash and no jump on remount.">

## 2. Attempts so far

For each prior attempt (minimum 2, whichever the session has):

### Attempt 1 — <approach name>
- **What was tried:** <one sentence — mechanism/API + key parameters>
- **What rendered / what broke:** <precise observable behaviour, NOT "it
  didn't work". Examples: "Only the first card is expandable", "Heights
  stale after first expand", "Content flashed before animating", "Full
  expansion on mount rather than collapsed-by-default".>
- **Most likely reason it failed:** <1-2 sentences of diagnosis>

### Attempt 2 — <approach name>
(same structure)

## 3. Candidate approaches for attempt #3

List **2-3** candidates. For each, include all four bullets — a one-line
description, a pro, a con, and a concrete cost estimate.

### Candidate A — <name, e.g. "the existing transition primitive, driven off a measured-height value">
- **How it works:** <one sentence>
- **Pro:** <specific to this surface, not generic>
- **Con:** <specific failure mode or complexity cost>
- **Cost:** <files touched, approx LOC, any new deps>

### Candidate B — <name>
(same structure)

### Candidate C — <name, optional>
(same structure)

## 4. Recommendation

**Pick:** Candidate <X>

**Why this one and not the others (concrete, not "it's simpler"):**
<2-3 sentences grounded in this project's constraints — e.g. "the existing
transition primitive is already a dependency elsewhere in this surface; the
declarative layout-animation shortcut doesn't reliably trigger for sibling
inserts per this platform's quirks; a manual-measurement approach would need
a ref redesign across the parent and its children.">

## 5. What I need from you before writing code

- [ ] A **screen recording** of the broken behaviour (15–30s, interact through
      the failing behaviour). Paste or attach.
- [ ] A **reference** of the desired behaviour (a clip, or a working sibling
      surface to mimic).
- [ ] Confirm the chosen candidate, OR pick a different one.

## 6. Hypothesis log — to be updated after attempt #3 lands

<Leave blank. After the third attempt, come back and write: what actually
fixed it, and which candidate's prediction was right. This is the piece
that makes the next ui-tradeoff in six weeks faster.>
```

## Handback protocol

Once the doc is written:

1. Share the doc path with the user.
2. Quote the §5 checkboxes back to the user so they see the explicit ask.
3. **Stop**. Do not write more UI code until the user either (a) provides
   the recording + picks a candidate, or (b) explicitly overrides the stop
   rule for this surface ("just try it").
4. When you return to code it, open the doc's §6 at the end and fill in
   what actually worked. This is the skill's compounding value — over time
   it becomes a playbook of which approaches win for which surfaces in
   this codebase.

## When NOT to use this skill

- First failed attempt at a new surface — keep iterating normally.
- Pure styling changes (color, padding, text) that don't involve timing
  or layout transitions.
- Static layout bugs (misaligned elements that don't animate) — those are
  normal diff-and-fix work.
- Anything a typecheck or a build catches — the skill is specifically for
  behaviour that a diff cannot prove correct.

## Related skills to chain

The common layer does not hardcode chain-skill names — look these up in the
pack/repo's own skill surface (`common/PACK-CONTRACT.md`):

- A **design-critique / review skill**, if the repo has one — after landing
  attempt #3 successfully, a quick critique catches any new UX regressions
  the rework introduced.
- The `skills/frontend-review` checklist — animated or reflowed UI is a
  common source of accessibility regressions (motion preferences, focus loss
  mid-transition); worth a pass once the behaviour is settled.
- A **debug skill**, if the repo has one — if the stuck behaviour turns out
  to be a state-management bug dressed up as a layout/animation bug
  (completion sync drift, stale cache), promote it to a proper debugging
  session instead of fighting the animation.

## Checklist before handing back

- [ ] File exists under `docs/ui-tradeoffs/` with the correct date + kebab name
- [ ] §2 has **at least 2** attempts with observable-behaviour notes (not "didn't work")
- [ ] §3 has **2–3** candidates, each with all four bullets filled in
- [ ] §4 picks one and gives a project-specific reason, not generic
- [ ] §5 asks for a screen recording — this is non-negotiable
- [ ] §6 exists as a blank section, ready for the post-fix update
