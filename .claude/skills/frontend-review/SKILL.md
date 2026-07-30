---
name: frontend-review
description: Cross-framework frontend review checklist — accessibility, responsive/adaptive layout, loading/error/empty states, optimistic-update and state-sync pitfalls, design-token adherence. Names no framework; packs add framework-specific anchors.
---

# frontend-review — a checklist that survives a framework swap

Use this skill when reviewing any UI change, regardless of which framework or
platform it's built on (a web page, a native app screen, a component library,
a design-system consumer). It names **no** framework, build tool, or
language — the categories below are true of frontend UI in general. A pack
adopted by the repo may layer its own framework-specific review anchors on
top (see the closing note).

This is a review checklist, not a build skill — it does not scaffold or write
UI code. Pair it with `skills/ui-tradeoff` when a review surfaces a
layout/animation/state-sync behaviour that has already failed twice.

## When to invoke

- Reviewing a diff, PR, or work item that touches UI — a new screen/page/view,
  a new or changed component, a restyle, a new interactive flow.
- As part of a design or implementation review gate where the changed surface
  is user-facing.
- Before shipping a UI change that touches forms, navigation, data-loading
  states, or anything a user directly interacts with.

## When NOT to use this skill

- Pure backend/API/data-layer changes with no rendered surface.
- Non-UI infra (build config, CI, tooling) unless it changes what actually
  renders.

## Checklist

Walk every category below for the changed surface. Cite the concrete file
and location for each finding — a category with nothing to flag is fine to
mark "clean," but don't skip walking it.

### 1. Accessibility

- **Semantic structure** — is the changed surface built from elements/roles
  that convey their purpose (headings, lists, buttons, form controls) rather
  than generic containers styled to look the part? A `<div>` (or platform
  equivalent) that behaves like a button is invisible to assistive tech and
  keyboard users unless given a role and behavior.
- **Focus order** — does focus move in a sequence that matches the visual/
  reading order? Does opening a modal/sheet/menu move focus into it, and does
  closing it return focus to the trigger? Is focus never silently lost
  (dropped to the document root) after a state change?
- **Keyboard navigation** — can every interactive element be reached and
  operated without a pointer? Are custom interactive widgets (custom
  dropdowns, drag targets, swipeable rows) operable via keyboard/switch
  control equivalents, or is there a documented fallback?
- **Color contrast** — do text/icon-vs-background pairs meet a contrast
  minimum (WCAG AA: 4.5:1 normal text, 3:1 large text/icons)? Check both
  light and dark themes if the surface supports both, and any state colors
  (error red, success green, disabled gray) — these are frequently under-
  contrasted.
- **Labels and alt text** — does every form control have a programmatically
  associated label (not just adjacent placeholder text)? Does every
  meaningful image/icon have alt text or an accessible name, and are
  purely-decorative images marked as such so they're skipped?

### 2. Responsive / adaptive layout

- Does the surface hold up across the size range the app actually ships to
  (narrow phone width through wide desktop, or the platform's equivalent
  range) without clipped text, overlapping elements, or content that
  requires horizontal scrolling it shouldn't?
- Do interactive targets meet a minimum touch/click target size on
  touch-primary layouts?
- Does content reflow (wrap, stack, truncate-with-affordance) rather than
  overflow silently at the layout's edges?
- If the surface adapts to safe areas, insets, or orientation changes, does
  it actually respond to those, or is it hardcoded to one configuration?

### 3. Loading / error / empty states

- Does every data-fetching surface have an explicit **loading** state (not
  a blank screen, not stale content presented as current)?
- Does every data-fetching surface have an explicit **error** state that
  tells the user something actionable happened (not a silent failure, not a
  raw technical error string surfaced verbatim)?
- Does every list/collection surface have an explicit **empty** state,
  distinct from the loading state, when the result set is legitimately
  empty?
- Are these three states mutually exclusive in the actual render logic — no
  window where loading and error, or error and stale content, render
  simultaneously?

### 4. Optimistic updates and state-sync pitfalls

- If a mutation optimistically updates local UI before the server confirms,
  is there a defined rollback path when the server rejects it (not just "the
  next refetch will fix it")?
- Does a real-time or push-driven update (a socket event, a poll tick, a
  subscription) correctly merge with in-flight local state instead of
  clobbering an optimistic update that hasn't confirmed yet?
- Is there a race between "user action fires a local state change" and
  "background refresh overwrites it with stale data" — e.g. a toggle that
  flips back because a slow refetch resolves after the tap?
- Are loading/mutation flags scoped precisely enough that one in-flight
  operation doesn't visually block or spin an unrelated part of the UI?

### 5. Design-token adherence

- Are colors sourced from the design-token/theme system rather than
  hardcoded literals (hex codes, raw RGB values) sprinkled through the
  component?
- Is spacing (margin, padding, gap) sourced from the token scale rather than
  arbitrary pixel/point values invented per-component?
- Do typography choices (size, weight, line-height) come from the type scale
  rather than one-off overrides?
- If the surface supports multiple themes (light/dark, brand variants), do
  the tokens used actually resolve correctly in every theme, or does a
  hardcoded value silently defeat theme-switching?

## Output shape

Report findings the same way any review does in this repo — cite the file
and line, state the category (1–5 above), and state the concrete failure
mode, not a vague "improve accessibility." A finding with no concrete
file/location is not actionable; keep looking or drop it.

## Related skills to chain

- `skills/ui-tradeoff` — if a finding here is actually a layout/animation/
  state-sync behaviour that has already failed two prior attempts, route
  there instead of prescribing a third blind fix.
- Any accessibility-specific audit skill the repo/pack provides — this
  checklist's §1 is a fast pass, not a substitute for a dedicated audit tool
  when one is available.

## Note on framework packs

This checklist deliberately names no framework. **Framework packs add
framework-specific review anchors** on top of it — e.g. a hooks-rules anchor
for a component-hooks model, or a view-state-rules anchor for a platform's
native view lifecycle. Consult the adopted pack's own rules/skills surface
for those additions; this skill is the stack-agnostic floor every frontend
review starts from.
