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

`gh pr view <number> --json files --jq '.files[].path'` (works for squash,
merge and rebase merges). Then:

- **Affected screens:** entries whose `files` globs match any changed path.
- **New / removed screens:** compare `screens.json` before and after the merge.
- **Affected API tags:** the Swagger tags of the endpoints in changed
  `backend/FitnessPlatform.Application/Features/<Area>/` folders, plus the
  Swagger tags of every endpoint listed by a new or changed `screens.json`
  entry (an entry whose `endpoints` list changed counts as changed). Republish
  only these tags; published pages are enriched, so raw `wiki-api.py` output
  never equals them and cannot be diffed.

Nothing affected → report "wiki unchanged" and stop.

## 2. Prepare

Same as build step 1 (including `E2E_API_URL=<api_url>` for the portal), but skip booting the web portal when no screen is affected.

## 3. Apply

- **Create missing API pages first:** before writing any screen page, create
  every affected tag page that does not exist yet (and the "API reference"
  parent), so the screens' "Technical" links resolve and "Used by" is current.
- **Finding a page:** if the entry has a `notionPageId`, fetch it; otherwise
  `notion-search` for `"Screen id: <id>"` within the root page, fetch each
  candidate and accept it only if it contains the exact line
  `Screen id: <id>`. Before creating, also list the area page's children and
  match the same line. Create a page only when none matches.
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
