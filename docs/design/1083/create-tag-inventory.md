# Create-tag dialog — design inventory, issue #1083

Two renders beside this file:

- `create-tag-target.png` — **the contract.** What the dialog should look like.
- `create-tag-built.png` — what ships today, for comparison.

## Where this reference came from, and what that limits

**This is a screenshot the user supplied on 2026-09-21, not a pulled Figma
node.** The Figma tool hit its plan's call limit before the node could be
fetched, so unlike `docs/design/1073/`, there are no measured geometry values
here — no node ids, no exact px, no read-off hex except the one printed in the
image itself.

Treat every number below as **read off a screenshot**, not measured. Where the
built component already has a value that matches the design's intent, prefer
keeping it over inventing a new one. If the Figma budget frees up, pulling the
real node and replacing this file is worth doing.

Everything in the "Structure" and "Differences" sections is directly visible in
the image and is reliable. The palette section is explicitly not.

## Structure, top to bottom

A centred modal panel: white ground, rounded corners, drop shadow, a close `✕`
at the top right.

1. **Title** — `Create New Tag`, bold.
2. **Subtitle** — `Add details for your new tag.`, muted, smaller.
3. **Name** — label, then a single-line input spanning the panel width, with
   the placeholder `Enter tag name`.
4. **Description** — label reading exactly `Description` (**not**
   "Description (optional)"), then a multi-line input about three rows tall,
   placeholder `Enter tag description`.
5. **Color** — label, then:
   - a single row of **eight circular swatches**, left aligned, evenly spaced;
     the selected one carries a visible ring offset from the circle's edge;
   - **below the row**, a full-width text input holding the hex value. In the
     reference it reads `#3B82F6` in normal (not placeholder) ink, i.e. it is
     the current value, not a hint.
6. **Preview** — label, then a full-width panel with a light fill and a light
   border, padded, containing one small **tag pill**: a tag icon plus the text
   `Tag Preview`, rendered in the chosen colour (a light tint behind, the
   colour itself as the ink).
7. **Footer** — right aligned: `Cancel` (light, bordered) then `Create Tag`
   (solid green, white text).

## Differences from what ships today

| | Target | Built |
|---|---|---|
| Field order | Name, Description, Color | Name, Color, Description |
| Name placeholder | `Enter tag name` | none |
| Description label | `Description` | `Description (optional)` |
| Description placeholder | `Enter tag description` | none |
| Colour control | 8 preset swatches **+** a hex text input | one native colour input |
| Preview | a panel with a live tag pill | absent |
| Footer | unchanged in shape | unchanged in shape |

## The palette — inferred, confirm before hardcoding

Only **one** value is certain: the selected blue is printed in the image as
`#3B82F6`, and it already matches `CreateTagDialog.tsx`'s existing
`DEFAULT_COLOR` (`#3b82f6`). Good corroboration that the design and the
component agree on at least this one.

The other seven are **an inference from how they look**, in left-to-right
order: red, orange, amber, emerald, **blue (selected)**, violet, pink, slate.
They read as a standard 500-weight ramp. Do not paste a guessed hex into the
code without checking it against `create-tag-target.png` first, and say in the
PR which values were confirmed by eye and which were assumed.

## Why the palette is not a design token

`CreateTagDialog.tsx`'s own doc comment already settles this: `colorHex` is
per-coach runtime data, not a design token — the same carve-out `ClientTagPill`
relies on (`rules/code-style.md#design-tokens-over-hardcoded-values`).

A tag's colour is a value the coach picks and the backend stores. A preset list
of offered choices is therefore **data**, and belongs in this component as a
constant, **not** as eight `--gf-*` entries in `web/src/index.css`.

This also keeps the change clear of siblings #1079 and #1081, which both hold
`index.css`.

## Behaviour the image cannot tell you, which the issue rules on

- The swatches and the hex input are two views of **one** value: picking a
  swatch writes the text, and a valid hex typed in should light the matching
  swatch.
- What happens on an **invalid** hex must be decided explicitly rather than
  silently producing an unstyled preview pill. The existing `colorHex` Zod rule
  is only `min(1)`; a free-text hex field makes a real format rule worth having.
- The swatches are colour choices, so **colour alone cannot be the only
  indicator of which is selected** — the ring carries that, and each swatch
  needs an accessible name and keyboard operation.

## New copy, all three locales

The two placeholders, the `Preview` label and the preview pill's own
`Tag Preview` text are new strings and ship in `cs`, `en` and `de` in the same
commit (`rules/i18n.md#when-new-copy-lands`).

See [[docs/design/1073/shell-inventory.md]] for the same practice applied to a
properly measured Figma node.
