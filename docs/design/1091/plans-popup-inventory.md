# Plans-column popup — design inventory, issue #1091

Two renders beside this file:

- `plans-popup-target.png` — **the contract.** The wireframe's popup.
- `plans-popup-built.png` — what ships today, for comparison.

## Provenance, and what it limits

**Both images are user-supplied screenshots taken on 2026-09-21, not pulled
Figma nodes.** The Figma connector is at its plan's monthly call limit, so —
as with `docs/design/1083/` — there are no node ids, no measured px, and no
read-off hex. Every number below is **read off a screenshot** and marked
approximate. Structure, order and copy are reliable; exact sizes are not.

Where the built component already has a value that serves the same purpose,
prefer keeping it over inventing a new one.

## What the user ruled, before any of this

- **Keep the trigger icons.** The user explicitly approved the lucide
  `Dumbbell` (training) and `Utensils` (nutrition) over the wireframe's
  generic clipboard/file glyphs. The wireframe's *icons* are not the contract;
  its *layout* is. Use the same two icons inside the popup rows.
- **Keep locale-aware dates.** The wireframe's `Jan 26, 2026` is an English
  mock. `cs` renders `26. 1. 2026`; that is correct, not drift.

## Structure of the wireframe popup, top to bottom

A small white card, rounded corners, soft shadow, roughly 210px wide with
~12px padding. Its contents:

1. **Header row** — a circular avatar (~28px, muted fill) carrying the
   client's initials, then to its right two stacked lines: the client's
   **full name in bold** (~13px) and beneath it a **muted count line**
   reading `2 active plans` (~11px).
2. **One block per plan**, each two lines:
   - Line 1: a small (~12px) plan-type icon, then the **plan type as a bold
     label** — `Meal` / `Workout` — on the left; the plan's **start date,
     muted, right-aligned** on the same line.
   - Line 2: the **plan's name in muted text** (the mock shows
     `John mealplan (2,500 calories)` and `Strength Training (Copy)` — those
     are plan names, not extra fields).
   - Blocks are separated by ~10px. Whether a hairline sits between the
     header and the first block is **not resolvable** from the image; it
     reads as spacing alone.

## What ships today (`PlanIconsCell.tsx`)

A `HoverCard`, ~256px wide, with **no header**. One row per plan: the type
icon, then the **plan name in bold** (13px), then a muted `Since <date>` line
beneath. The plan *type* is conveyed only by the icon, never as text.

## The difference, stated once

The two structures are **inverted**:

| | Wireframe | Built |
|---|---|---|
| Header (avatar, name, count) | yes | none |
| Bold line 1 | plan **type** | plan **name** |
| Date | right-aligned, on line 1 | beneath, as `Since …` |
| Muted line 2 | plan **name** | the date |
| Type as text | yes (`Meal`/`Workout`) | no, icon only |

## Data — nothing new is needed

- `ClientActivePlanDto` (generated) carries `name`, `type`
  (`Profession.Training` / `Profession.Nutrition`) and `startDate`.
- The row DTO carries `firstName`, `lastName`, `avatarBlobUrl`.
- `ClientAvatar` (`web/src/components/clients/ClientAvatar.tsx`) already
  renders photo-or-initials and is what the table row uses — reuse it for the
  header so the popup and the row cannot disagree.
- `PlanIconsCell`'s props widen to take the client's name and avatar;
  `ClientsTable.tsx:163` passes them.

**No backend change. No `generated.ts` change.**

## Copy — new and removed

New, in `cs`, `en`, `de`:

- the two type labels (`Meal` / `Workout`) — pick keys that do not collide
  with the existing `sidebar.*` or `clients.*` labels;
- the count line, **as a proper plural** — Czech has one / few (2–4) / many
  forms. Use i18n plural keys; never concatenate a number onto a word.

Removed, from all three: `clients.table.planSince` (`Since {{date}}`) becomes
orphaned once the date moves to the right column. Delete it rather than leave
it.

## Open point for design review

Today the popup is a `HoverCard`. The wireframe's content is richer (a header
and multiple rows), so confirm whether hover-to-open is still right versus a
click-to-open `Popover`, and say why. Either way: `hover-card.tsx` is one of
the five primitives in **#1090** whose open/close animation is broken, so
this popup will appear instantly until that lands. Out of scope here — do not
touch `hover-card.tsx`.

See [[docs/design/1083/create-tag-inventory.md]] for the same
screenshot-based practice, including the case where the inference was wrong
and had to be corrected.
