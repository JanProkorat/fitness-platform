# Page templates, screenshot procedure, drafting brief

## Main page

- What the platform is (one paragraph): coaches (trainers, nutritionists)
  manage clients on the web portal; clients use the mobile app.
- Who uses which app — a 3-row table.
- How to read this wiki: app → area → screen; API reference; glossary.
- Links to the app pages, API reference, glossary.

## App page

Purpose of the app, who signs in, how to reach it (URL / store), then a list
of its area pages with one line each.

## Area page

What the area is for (2–3 sentences), then its screens as a list:
title — one-line purpose — link.

## Screen page (in this order)

1. **Purpose** — 1–2 sentences; which roles use it.
2. **Screenshots** — one image per shot, caption = shot name. Light only
   until the app has a dark theme; then light and dark side by side. While
   there is no dark theme, add the callout "Dark mode not available in the app
   yet — light only."
3. **How to get here** — route; the link or button that leads here.
4. **Controls** — table: Control (label as shown, Czech + English) | What it
   does | Options / allowed values | Default | Disabled or hidden when.
   Every button, dropdown, input, toggle, tab, filter chip, collapsible and
   row action gets a row.
5. **States** — empty, loading, error, role-dependent: what it looks like
   and what triggers it.
6. **Technical** — endpoints called (each links to its API reference
   heading), source files from `files`.
7. **Screen id** — last line of the page: `Screen id: <id>`.

## API reference page (one per Swagger tag)

The `wiki-api.py` Markdown, plus under each endpoint:

- **Error codes** — table: Code | When. Read `SendProblemAsync(...)` and
  `ThrowErrorWithCode(...)` calls in the endpoint; codes are the values in
  `Domain/Constants/ErrorCodes.cs`.
- **Validation rules** — one bullet per rule from the endpoint's
  `*Validator.cs`.

## Screenshot procedure (main thread)

1. Browser: Playwright tool, Brave. Window 1440×900. Navigate to
   `http://localhost:5173/` first, run `localStorage.setItem('lang','cs')` with
   `browser_evaluate`, then navigate to the target route.
2. Sign in as the role the shot needs (credentials in
   `docs/testing/e2e-fixtures.md`). `Public` screens: signed out.
3. Navigate to the entry's `route` (replace `:param` with a seeded id). Run
   the shot's `steps`. Wait for network idle and for animations to finish.
4. `browser_take_screenshot` to `<scratchpad>/shots/<id>--<shot>.png`.
5. `notion-create-file-upload` with filename `<id>--<shot>.png` returns
   `upload_url` and `upload_headers`; run
   `python3 scripts/notion-upload.py <upload_url> "<upload_headers.authorization>" <file>`.
   The file name must equal the upload's filename.
6. The script's JSON output contains `suggested_markdown` — place exactly that
   on the page (not a hand-written tag). Unplaced uploads expire within an hour.
7. Mobile screens: not yet — native iOS Simulator screenshots
   (`xcrun simctl io booted screenshot`) return with the paused iOS QA path
   (see `.claude/agents/qa-tester.md`); never use Expo web for wiki screenshots.
8. **On failure** (route errors, a step's control not found): keep the
   page's existing image and add the callout
   "⚠️ Screenshot out of date — capture failed on <date>". List it in the
   run summary.

## Drafting brief (send to a Sonnet sub-agent per screen)

> Read-only. Write the text for one wiki page about a screen of the
> GoodFellas app, for a new team member. English, plain, short sentences.
> Screen: `<id>` — `<title>`, route `<route>`, roles `<roles>`.
> Source files: `<files>`. Endpoints: `<endpoints>`.
> UI labels: read Czech from `web/src/i18n/locales/cs.json` and English from
> `en.json` (for mobile, the `mobile/src/i18n/locales/` files).
> Return Markdown only, with exactly these sections: Purpose, How to get
> here, Controls (table with the five columns: Control | What it does |
> Options / allowed values | Default | Disabled or hidden when), States.
> Cover every interactive element in the source files. For each claim you
> are unsure of, append "(unverified)". Do not include screenshots or
> endpoint docs.
