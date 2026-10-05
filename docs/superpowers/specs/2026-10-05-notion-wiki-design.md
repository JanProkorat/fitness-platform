# Notion wiki — design

Date: 2026-10-05. Status: awaiting review. Replaces the `notion-docs`
skill's hub-and-changelog tree, which was cleared in #1160.

## Goal

Notion becomes a wiki for a **new team member** (tester, developer, product
person) who must learn the whole app. It explains every app, area and screen —
every button, dropdown, input, toggle and collapsible — with real-app
screenshots, and documents every API endpoint with all its parameters.
Written in **English**. Not customer-facing.

Success: a new team member can open any shipped screen's page and know what
every control does, what states the screen has, and which endpoints it calls,
without reading code.

## Decisions (agreed 2026-10-05)

| Question | Decision |
|---|---|
| Top-level "module" | App → business area → screen |
| Screenshot source | The real running app, never the design boards |
| API docs placement | One API reference + a linked "Technical" list on each screen page |
| Reader | New team member |
| Language | English (app screenshots in Czech, the primary locale) |
| Update trigger | At the end of each task: after its PR merges (into the epic branch or `develop`), only what changed |
| Starting inventory | Empty — each redesign task adds its screens when it ships (decided 2026-10-05) |
| API content source | Generated from Swagger, plus error codes and validator rules read from code |
| Screenshot upload | `scripts/notion-upload.py` (curl stays denied); verified 2026-10-05 |

## 1. Page tree

```
Main page — what the platform is, who uses which app, how to read the wiki
├─ Coaching portal (web)        app page: purpose, who signs in, area list
│  ├─ <Area>                     area page: purpose, screen list
│  │  └─ <Screen>                screen page
├─ Client app (mobile)           pages appear as screens ship
├─ Coach app (mobile)
├─ API reference                 one page per Swagger tag
└─ Glossary                      domain terms
```

A screen gets a page only once it exists in the real app.

### Screen page, in order

1. **Purpose** — one or two sentences: what the user does here, which roles see it.
2. **Screenshots** — light and dark; light only (with a note) while the app has no dark theme.
3. **How to get here** — route, and the link or button that leads here.
4. **Controls** — table, one row per control: label as shown, what it does,
   options / allowed values, default, when disabled or hidden.
5. **States** — empty, loading, error, role-dependent; what triggers each.
6. **Technical** — endpoints called (links into the API reference) and the
   screen's source files.

### API reference page (one per Swagger tag)

Per endpoint: method + route, allowed roles, every route/query/body parameter
(type, required, allowed values, description), validator rules, response shape
as a field table, every status code with its meaning, error codes and what
triggers them, and "Used by" links to screen pages.

## 2. Screen inventory — `docs/wiki/screens.json`

The machine-checkable source of which screens exist. The wiki tool never
creates a screen page without an entry.

```json
{
  "id": "web.clients.list",
  "app": "web",
  "area": "Clients",
  "title": "Client list",
  "route": "/clients",
  "roles": ["Trainer", "Nutritionist"],
  "files": ["web/src/pages/ClientsPage.tsx", "web/src/components/clients/**"],
  "endpoints": ["GET /trainer/clients", "POST /trainer/clients/invite"],
  "board": "PageClients",
  "shots": [
    { "name": "default" },
    { "name": "invite-drawer", "steps": "click 'Invite client'" }
  ],
  "notionPageId": null
}
```

- `id` — unique, `<app>.<area>.<screen>`, lowercase.
- `app` — `web` | `client` | `coach`.
- `files` — globs; a merge touching any of them marks the screen for update.
- `endpoints` — `METHOD /route` exactly as in Swagger.
- `board` — redesign board name, for reference only (never screenshotted).
- `shots` — each captured in every available theme; `steps` are the clicks
  needed to reach that state.
- `notionPageId` — optional hint, set by hand when known. Runs find a screen's page by its `Screen id: <id>` line, so nothing is committed after a merge.

Descriptions (purpose, controls, states) are **not** stored here — they are
written from code and live only in Notion.

**Kept current by:** the dev agent that adds or changes a screen (same PR);
`pr-reviewer` flags a new screen, route or endpoint call with no matching
entry; `scripts/wiki-check.py` in CI.

**`scripts/wiki-check.py`** fails when: a `files` glob matches nothing; an
`endpoints` entry is absent from Swagger; an `id` is duplicated; a required
field is missing. Swagger is read from a file path argument so CI can pass a
freshly generated copy.

## 3. API reference generation

1. Boot the backend (compose harness or `dotnet run`); save the current
   Swagger JSON with a Python fetch (no curl). Generated, not committed.
2. `scripts/wiki-api.py <swagger.json> <screens.json> <out-dir>` writes one
   Markdown file per Swagger tag: endpoints, parameters, request/response
   schemas flattened to field tables, status codes, roles, "Used by" links.
3. The wiki tool adds what Swagger lacks by reading the endpoint folder:
   error codes from `SendProblemAsync` / `ThrowErrorWithCode` with their
   triggers, and rules from the endpoint's validator.
4. Only pages whose content changed are rewritten.

Swagger is copied faithfully. Where it is wrong (e.g. `page`/`pageSize`
marked required despite defaults on `GET /trainer/clients`), the fix is in the
backend's `Summary(...)` or request attributes, never in the wiki.

## 4. Screenshots

**Web (now).** Main thread only (Playwright browser tool, Brave). Against the
test harness: API `:5101`, web `:5173`, signed in as the seeded role from
`docs/testing/e2e-fixtures.md`. Window 1440×900, `lang` = `cs`, wait for
animations. Per shot: open route → run `steps` → capture → create upload with
`notion-create-file-upload` → send with `scripts/notion-upload.py` → place or
replace the image block.

**Mobile (later).** Native iOS Simulator screenshots (`xcrun simctl io booted
screenshot`), not Expo web. Blocked until the paused iOS QA path returns with
a test sign-in (see `.claude/agents/qa-tester.md`).

**Failure.** The page keeps its previous image and gets a visible
"screenshot out of date" note; the run summary lists it. A failed capture
never deletes an image.

## 5. Modes and update flow

**The wiki grows task by task.** `screens.json` starts empty and nothing
is built up front. Each redesign task that ships a screen adds its entry;
the update run at the end of that task creates the page. Missing app, area,
"API reference" and "Glossary" pages are created the first time they are
needed. The Notion root page `Fitness & Nutrition Platform`
(`3451c0f6-641f-81cf-b502-fbd0e6227e27`) is reused.

**Build** — recreates the full tree from `screens.json` + Swagger. Only for
recovery, when the tree is lost or the user asks for a rebuild.

**Update** — at the end of every task: after its PR merges, into the epic
branch (sub-issue) or `develop` (standalone or epic PR):

1. List the files the merge changed.
2. Match against `screens.json` `files` → affected screens; changed folders
   under `backend/**/Features/` → affected endpoints and their tags.
3. Per affected screen: re-read the code, rewrite purpose/controls/states,
   retake screenshots. Per affected tag: regenerate its API page.
4. New entry → new page + link on its area and app pages. Removed entry →
   page moved to Notion's trash.
5. Summary in chat: updated, created, trashed, failed screenshots.

**Who does what.** Sonnet sub-agents draft screen-page text from code and
return Markdown only. The main thread takes screenshots, uploads, and writes
to Notion.

**No changelog.** Git and GitHub hold history; the wiki describes the app as
it is now.

## Repo changes

- Rewrite `.claude/skills/notion-docs/SKILL.md` and its `references/`
  (`build.md` replacing `bootstrap.md`, `update.md`, `page-templates.md`);
  delete `references/routing.md` (replaced by `screens.json`).
- Add an empty `docs/wiki/screens.json` (`{"screens": []}`).
- Move the docs trigger from "develop merges only" to "every task's merge"
  in `.claude/rules/merge-strategy.md`, `.claude/CLAUDE.md` (task lifecycle)
  and `pr-reviewer`.
- Add `scripts/wiki-api.py`, `scripts/wiki-check.py`; commit the existing
  `scripts/notion-upload.py`.
- Add a `wiki-check` step to CI.
- Add the "keep `screens.json` current" rule to `web-react`, `mobile-expo`
  and `pr-reviewer`.

## Out of scope

- Writing any wiki content. Pages appear as redesign tasks ship.
- Mobile screenshots (blocked on the paused iOS QA path).
- Dark-theme screenshots for web (no dark theme in the app yet).
- Fixing Swagger inaccuracies in the backend.
