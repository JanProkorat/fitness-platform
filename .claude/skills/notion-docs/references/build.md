# Build mode — recreate the whole wiki

Recovery only: the tree was lost, or the user asks to rebuild everything.
Normal growth happens in update mode, task by task. Reuses the root page.

## 1. Prepare

1. If `.env.test` is missing at the repo root, run `npm run e2e:setup` (in a
   worktree, symlink the main checkout's `.env.test`) — never write `.env*`
   files by hand. Boot the test harness from the repo root: `./scripts/test-env up`,
   then `./scripts/test-env ports` → `api_url`. Start the web portal against it
   (`E2E_API_URL=<api_url> npm run dev:e2e` in `web/`, port 5173). Kill anything already on :5173
   from another worktree first (`lsof -i :5173`).
2. `python3 scripts/fetch-swagger.py <api_url> <scratchpad>/swagger.json`.
3. `python3 scripts/wiki-check.py --swagger <scratchpad>/swagger.json` —
   stop and fix `screens.json` if it fails.
4. `python3 scripts/wiki-api.py --swagger <scratchpad>/swagger.json --out <scratchpad>/wiki-api`.

## 2. Skeleton (Notion)

Replace the root page content with the **Main page** template. Create, as
children of the root, in this order: one **App page** per `app` value that has
entries (`web` → "Coaching portal (web)", `client` → "Client app (mobile)",
`coach` → "Coach app (mobile)"), then "API reference", then "Glossary". Under
each app page create one **Area page** per distinct `area`.

## 3. Screen pages

For each entry in `screens.json`:

1. Dispatch a drafting sub-agent (Sonnet) with the **drafting brief** from
   `page-templates.md`, filled with the entry. Up to 4 in parallel.
2. Take the entry's screenshots with the **screenshot procedure**.
3. Create the screen page under its area page from the **Screen page**
   template: drafted text + uploaded images. Links in "Technical" point to
   the endpoint's heading on its API reference page.
4. End the page with the line `Screen id: <id>`.

## 4. API reference

Create one child page of "API reference" per file in `<scratchpad>/wiki-api/`,
titled with the file's H1 (the Swagger tag), not the file name. Before publishing, enrich each endpoint with the
**error codes** and **validation rules** section (see `page-templates.md`),
read from the endpoint folder under `backend/FitnessPlatform.Application/Features/`.
Replace each `Used by` screen id with a mention of that screen's page.

## 5. Glossary

One table of domain terms (term, meaning, where it appears). Seed it from
terms used on the screen pages; Czech product terms keep their Czech word
with the English meaning (e.g. "kouč — coach").

## 6. Finish

Stop the harness
(`./scripts/test-env down`) and the dev server. Report the summary.
