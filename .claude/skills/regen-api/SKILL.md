---
name: regen-api
description: Regenerate the typed TS API client from a running backend's OpenAPI/Swagger source — generic over the generator (NSwag, openapi-typescript-codegen, orval, swagger-typescript-api, openapi-generator, etc). Invoke after any route / request / response / DTO change.
argument-hint: "(no arguments — reads the repo's own generator config)"
---

# regen-api — regenerate the typed API client

Run this after a backend contract change, before updating any call site that
consumes it. The generated client file is write-locked by a PreToolUse hook
(`block-generated-client.py`) — you can only update it through this
regeneration flow, never by hand-editing.

## Which generator does this repo use?

This skill does not assume one generator. Check the repo's own `CLAUDE.md`
and its `package.json` scripts for which of these (or another) is wired up:

| Generator                     | Typical invocation                                              |
|--------------------------------|-------------------------------------------------------------------|
| NSwag                          | `dotnet nswag run nswag.json` (config lives on the backend side)  |
| `openapi-typescript-codegen`   | `npx openapi-typescript-codegen --input <spec> --output <dir>`    |
| `orval`                         | `npx orval --config orval.config.ts`                              |
| `swagger-typescript-api`       | `npx swagger-typescript-api -p <spec> -o <dir>`                   |
| `openapi-generator-cli`        | `npx @openapitools/openapi-generator-cli generate -i <spec> -g typescript-fetch -o <dir>` |

Whichever it is, the repo almost certainly wraps it in an npm script (e.g.
`npm run generate-api`) — prefer that script over reconstructing the raw
generator invocation, so you inherit any post-processing (header injection,
`// @ts-nocheck` prepending, sed passes) the repo already does.

## Prerequisites

1. The backend running with its OpenAPI/Swagger endpoint enabled — confirm
   the URL the repo's generator config points at (commonly something like
   `https://localhost:<port>/swagger/v1/swagger.json` or `/openapi.json`).
   Verify it's reachable before running codegen:
   ```bash
   curl -sk <swagger-url> | head
   ```
2. Whatever CLI the chosen generator needs (a `dotnet tool` for NSwag, an
   `npx`-resolved package for the JS-native generators) is installed.
3. `node_modules/` already populated — do NOT run `npm install` "to be
   safe" before or after regen unless the generator genuinely needs a
   fresh install (see the lockfile warning below).

## Lockfile safety — never run `npm install` as a reflex during regen

Most codegen scripts need **zero** npm package installation to run — they
fetch the spec (`curl`), run a code generator (a `dotnet` tool, or an
already-installed `npx` package), and optionally post-process the output
(`sed`, a small Node script). Running `npm install` against an existing
`package.json` re-resolves the whole dependency tree and rewrites
`package-lock.json` — it can silently strip a transitive dependency npm
decides is redundant but that `npm ci` still needed, breaking CI on an
unrelated dependency days later with no connection visible in the diff that
introduced it.

**Safe rules of thumb:**

- Don't run `npm install` ahead of a regen "just in case" — the generator
  script itself does not need it.
- If you need a fresh `node_modules` for a downstream step (e.g. `tsc
  --noEmit` after regen), use **`npm ci`** — it's strictly lockfile-
  preserving and never modifies `package-lock.json`. Never substitute
  `npm install` for it mid-regen.
- After regen, **verify the lockfile didn't drift**:
  ```bash
  git status package-lock.json
  ```
  It should show no entry. If it shows up, restore it before committing
  (e.g. `git checkout origin/<base-branch> -- package-lock.json`) and
  investigate why regen touched it — that's a sign a step you ran (or a
  postinstall script) did more than codegen.
- `package.json` should not appear in a regen commit unless the regen
  script's own version changed. Treat regen as "client-types only" — the
  generated client file is the entire authoritative diff.

## Running the regen

```bash
npm run generate-api    # or whatever script name the repo's own
                         # package.json defines — read it, don't assume
```

If the repo has no such script yet and you need one, ask before adding it —
scripting a raw generator invocation into `package.json` requires deciding
output paths and generator options the repo owner should confirm.

## After regeneration

1. **Do NOT hand-edit the generated client file.** The PreToolUse hook
   `block-generated-client.py` rejects Edit/Write on it.
2. **Lockfile sanity check** (before any other step):
   ```bash
   git status package-lock.json
   ```
   Must be untouched. If it drifted, restore it from the base branch first
   (see the lockfile warning above).
3. Type-check the consumer: `npx tsc --noEmit` (or the repo's typecheck
   command — see `react-build`).
4. Fix breakage in wrapper modules (e.g. `src/api/*.ts`) — rename imports,
   update mapping functions, adjust form-validation schemas that mirrored
   the old shape.
5. Search for call sites of anything renamed: `grep -rn "<old name>" src/`.
6. If the regen produced no diff, the contract change did not actually
   change the OpenAPI/Swagger output — double-check the backend work before
   assuming the client is already correct.

## Who runs this

- The client-side dev sub-agent (or the developer working `/web`-equivalent
  code) runs it when a backend contract change affects call sites it owns.
  It does not need the orchestrator/backend agent to run it on its behalf —
  refreshing its own generated client is its job.
- The orchestrator runs it directly only when the backend change needs no
  client-side work afterwards, or when coordinating multiple client
  packages (web + a second frontend) at once is easier than separate
  dispatches.

## When NOT to run

- The backend change is internal only (private service, test helper, a
  migration with no API-surface change). Skip the regen.
- The backend hasn't been rebuilt/restarted since the change — rebuild or
  restart it first, otherwise the OpenAPI/Swagger source returns stale
  output and the "regen" produces no real diff.

## Checklist

- [ ] Backend reachable at its OpenAPI/Swagger URL, freshly built
- [ ] `node_modules/` populated (use `npm ci` if not — never `npm install`)
- [ ] The repo's generate-api script (or generator invocation) succeeds
- [ ] **`git status package-lock.json` shows zero diff**
- [ ] `npx tsc --noEmit` (or repo's typecheck command) clean
- [ ] Wrapper modules updated where needed
- [ ] No hand-edits in the generated client file (hook blocks these anyway)
- [ ] `package.json` not in the regen commit unless the generator version
      itself changed
