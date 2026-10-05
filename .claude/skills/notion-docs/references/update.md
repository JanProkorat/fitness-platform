# Update mode — at the end of every task

Runs after the task's PR merges: into the epic branch for a sub-issue, into
`develop` for a standalone or epic PR. The wiki grows from here — there is no
up-front build.

## 0. Make sure the skeleton exists

Fetch the root page. Create whatever this run needs and is missing, using the
templates in `page-templates.md`: the Main page content, "API reference",
"Glossary", and the app and area pages only for entries this run touches. A
backend-only change creates only "API reference" (and the tag page) if
missing. Never recreate a page that exists.

## 1. What changed

`git diff --name-only <merge-commit>^1 <merge-commit>` (for a squash merge,
`<commit>^ <commit>`). Then:

- **Affected screens:** entries whose `files` globs match any changed path.
- **New / removed screens:** compare `screens.json` before and after the merge.
- **Affected API tags:** for changed paths under
  `backend/FitnessPlatform.Application/Features/<Area>/`, the Swagger tags of
  the endpoints in those folders. Any backend change also re-runs
  `wiki-api.py` and republishes only tag pages whose Markdown differs from
  what is in Notion.

Nothing affected → report "wiki unchanged" and stop.

## 2. Prepare

Same as build step 1 (including `E2E_API_URL=<api_url>` for the portal), but skip booting the web portal when no screen is affected.

## 3. Apply

- **Finding a page:** if the entry has a `notionPageId`, fetch it; otherwise
  `notion-search` for `"Screen id: <id>"` within the root page. Create a page
  only when neither finds it.
- **Affected screen:** re-draft its text (drafting brief), retake its shots,
  replace the page body. Keep the page id.
- **New screen:** as build step 3 (ending with the `Screen id: <id>` line), and add its link to the area page (create
  the area page if it is new).
- **Removed screen:** move its page to the trash (replace the area page's
  content without that child, `allow_deleting_content: true`); remove its
  link.
- **Affected tag:** republish that API reference page, enriched as in build.

## 4. Finish

Stop the harness and dev server. Report:
pages updated / created / trashed, failed shots.
