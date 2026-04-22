---
name: ui-tradeoff
description: Enforce the two-attempt stop rule for UI iteration (Working Principles §4). Invoke when a mobile/web animation, layout, or state-sync behaviour has failed twice in a row on the same surface — expand/collapse stuttering, animations that don't trigger, completion-state sync drifting, content flashing before animating, any case where the user has said "it does not work" or equivalent on the same surface twice. Produces a tradeoff doc in `docs/ui-tradeoffs/` comparing 2-3 candidate approaches and asks the user for a screen recording before more code is written.
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
- The behaviour involves pixel/frame timing or gesture handling where a
  written diff cannot prove it works.

## What this skill does NOT do

- Does not write animation code for you.
- Does not pick the "right" approach — it forces a documented choice.
- Does not replace a screen recording — it **demands** one.

## Before you start the doc

Collect from the session (or ask the user if missing):

1. **Surface** — which component/screen and which behaviour, stated precisely.
   Examples: "Expand/collapse of `TrainingCard` children on the Today screen",
   "Completion-state sync between `SetRow` taps and the aggregate progress
   bar on `WorkoutLogScreen`", "Keyboard push-up of `ChatInputBar` on iOS
   only".
2. **What 'done' looks like** — the acceptance criterion, in one sentence.
   Example: "Tapping the card header expands it smoothly over ~200ms, measured
   once, with no content flash and no jump on mount".
3. **Library context** — what's already in the file (`react-native-reanimated`
   v3, `LayoutAnimation`, `Animated`, Tailwind transitions, Framer Motion,
   etc.) and what's loaded elsewhere in the package. Pick from the set
   that's already a dependency — adding a new animation lib is a separate
   decision, not a rescue attempt.

## Produce the doc

Write to `docs/ui-tradeoffs/<YYYY-MM-DD>-<short-kebab-desc>.md`
(create the folder on first use). The file name must be searchable later
when the same class of bug recurs — include the surface, e.g.
`2026-04-22-expand-collapse-training-card.md`.

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
- **What was tried:** <one sentence — library/API + key parameters>
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

### Candidate A — <name, e.g. "Reanimated v3 `useAnimatedStyle` with `withTiming` on measured height">
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
<2-3 sentences grounded in this project's constraints — e.g. "Reanimated v3
is already a dependency; LayoutAnimation doesn't reliably trigger on Android
for sibling inserts per our Expo SDK 55 quirks; measure() worklets would
need a Pressable ref redesign across `TrainingCard` and its children.">

## 5. What I need from you before writing code

- [ ] A **screen recording** of the broken behaviour (15–30s, tap through
      the failing interaction). Paste or attach.
- [ ] A **reference** of the desired behaviour (GIF, video, or a working
      sibling screen to mimic).
- [ ] Confirm the chosen candidate, OR pick a different one.

## 6. Hypothesis log — to be updated after attempt #3 lands

<Leave blank. After the third attempt, come back and write: what actually
fixed it, and which candidate's prediction was right. This is the piece
that makes the next ui-tradeoff in six weeks faster.>
```

## Handback protocol

Once the doc is written:

1. Share the doc path with the user (as a `computer://` link if in Cowork).
2. Quote the §5 checkboxes back to the user so they see the explicit ask.
3. **Stop**. Do not write animation code until the user either (a) provides
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

- **`design:design-critique`** — after landing attempt #3 successfully,
  a quick critique catches any new UX regressions the rework introduced.
- **`design:accessibility-review`** — animated UI is a common source of
  a11y regressions (motion preferences, focus loss mid-transition); worth
  a pass once the behaviour is settled.
- **`engineering:debug`** — if the stuck behaviour turns out to be a
  state-management bug dressed up as an animation bug (completion sync
  drift, stale query cache), promote it to a proper debugging session
  instead of fighting the animation.

## Checklist before handing back

- [ ] File exists under `docs/ui-tradeoffs/` with the correct date + kebab name
- [ ] §2 has **at least 2** attempts with observable-behaviour notes (not "didn't work")
- [ ] §3 has **2–3** candidates, each with all four bullets filled in
- [ ] §4 picks one and gives a project-specific reason, not generic
- [ ] §5 asks for a screen recording — this is non-negotiable
- [ ] §6 exists as a blank section, ready for the post-fix update
