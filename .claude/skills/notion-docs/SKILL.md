---
name: notion-docs
description: Build and update the GoodFellas Notion wiki — app → area → screen pages explaining every control, real-app screenshots, and an API reference generated from Swagger. Two modes — update (after every merge into `develop`: a standalone task PR or an epic PR, never a task PR into an epic branch) and build (recovery rebuild). Main thread only. Invoke on "update the wiki", "update the docs", "rebuild the wiki", or after any PR merges into `develop`.
---

# notion-docs — the Notion wiki

Notion holds an English wiki for a **new team member** (tester, developer,
product person). It explains every shipped screen and every API endpoint.
Design: `docs/superpowers/specs/2026-10-05-notion-wiki-design.md`.

**Main thread only.** Screenshots need the Playwright browser tool and pages
need the Notion tools; sub-agents have neither. Sub-agents only draft text.

## Modes

| Mode | When | Reference |
|---|---|---|
| `update` | **After every merge into `develop`** — a standalone task PR after its own merge, an epic PR once after the whole epic merges — or "update the wiki". Never after a task PR merges into an epic branch. | [`references/update.md`](references/update.md) |
| `build` | Recovery only: the tree was lost, or the user asks to rebuild everything. | [`references/build.md`](references/build.md) |

Default to `update`. The wiki grows merge by merge: `screens.json` starts
empty, and update creates any missing app, area, API reference or glossary
page the first time it needs one. An epic run covers every file the epic PR
changed.

## Fixed facts

- Root page: `Fitness & Nutrition Platform`, id `3451c0f6-641f-81cf-b502-fbd0e6227e27`.
- Screen inventory: `docs/wiki/screens.json` — the only source of which
  screen pages exist. Never create a screen page without an entry.
- Finding a screen's page: fetch its `notionPageId` if the entry has one;
  otherwise `notion-search` for `"Screen id: <id>"` within the root page, then
  fetch each candidate and accept it only if it contains the exact line
  `Screen id: <id>` (search is fuzzy and lags new pages). Before creating, also
  list the area page's children and match the same line. Create a page only
  when none matches.
- Page shapes, the screenshot procedure and the drafting brief:
  [`references/page-templates.md`](references/page-templates.md).
- Scripts: `scripts/wiki-check.py`, `scripts/fetch-swagger.py`,
  `scripts/wiki-api.py`, `scripts/notion-upload.py`.
- No changelog page. The wiki describes the app as it is now.

## Rules

- English only. Screenshots show the app in Czech (`lang` = `cs`).
- Screenshots come from the real app against the test harness, never from
  design boards and never from personal data.
- Swagger is copied faithfully. A wrong Swagger fact is a backend issue to
  report, not something to correct in the wiki.
- A failed screenshot keeps the old image and adds the "screenshot out of
  date" callout; never delete an image because a capture failed.
- Every screen page ends with a last line `Screen id: <id>`. Nothing is
  committed after a merge.

## Done when

- `python3 scripts/wiki-check.py --swagger <fresh swagger>` passes.
- Every entry in `screens.json` has exactly one page carrying its `Screen id:` line.
- The run summary lists pages created, updated, trashed and failed shots.
