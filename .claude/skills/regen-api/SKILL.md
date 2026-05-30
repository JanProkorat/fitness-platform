---
name: regen-api
description: Regenerate TS API client (generated.ts) from running backend Swagger via NSwag. Invoke after any route / request / response / DTO change. Covers /web and /mobile.
---

# regen-api — regenerate TypeScript API client

Run this after a backend contract change, before updating any web or mobile
call site. The generated files are write-locked by a PreToolUse hook — you can
only update them through this regeneration flow.

## Prerequisites

1. Backend running on `https://localhost:5001` with Swagger enabled:
   ```bash
   cd backend/FitnessPlatform.Application
   dotnet run
   ```
   Verify: `curl -sk https://localhost:5001/swagger/v1/swagger.json | head`
2. NSwag tool available via `dotnet tool`. If missing:
   `dotnet tool restore` in `/backend`.
3. `node_modules/` already populated — do NOT run `npm install` (see ⚠️ below).

## ⚠️ Lockfile safety — never run `npm install` during regen

**`npm run generate-api` does NOT use npm packages.** The script is pure
shell: `curl` (fetch Swagger) → `dotnet nswag` (codegen) → `sed`
(post-process). Zero npm involvement.

**Do NOT run `npm install` "to be safe" before or after regen.** Running
`npm install` against an existing `package.json` re-resolves the dependency
tree and rewrites `package-lock.json`, sometimes stripping transitive peer
deps that npm decides are redundant but `npm ci` still needs.

**Real incident (#329 / #348):** during the #329 web slice, an extraneous
`npm install` stripped `@floating-ui/dom@1.7.6` from the lockfile. CI then
broke with `EUSAGE: Missing @floating-ui/dom@1.7.6 from lock file`.
Recovery in commit `d2e617f` required restoring `web/package-lock.json`
from `develop`.

**Safe rules of thumb:**

- The `generate-api` script needs nothing from `node_modules` — do not
  `npm install` ahead of it.
- If you need a fresh `node_modules` (e.g. for `tsc --noEmit` after regen),
  use **`npm ci`** — it's strictly lockfile-preserving and never modifies
  `package-lock.json`. Never use `npm install` mid-regen.
- After regen, **verify the lockfile didn't drift**:
  ```bash
  git status web/package-lock.json mobile/package-lock.json
  ```
  Both should show no entry. If one shows up, restore it before committing:
  ```bash
  git checkout origin/develop -- web/package-lock.json
  git checkout origin/develop -- mobile/package-lock.json
  ```
- `package.json` must NEVER appear in a regen commit. Treat the regen as
  "client-types only" — `generated.ts` is the entire authoritative diff.

## Web (`/web`) — supported out of the box

The regen pipeline lives in `web/package.json`:

```bash
cd web
npm run generate-api
```

Under the hood this:
1. Fetches `https://localhost:5001/swagger/v1/swagger.json` into `/backend/swagger.json`
2. Runs `dotnet nswag run nswag.json` (config in `/backend/nswag.json`)
3. Post-processes `web/src/api/generated.ts` to prepend `// @ts-nocheck`

**Zero npm involvement — `package-lock.json` MUST stay untouched.**

## Mobile (`/mobile`) — manual today

There is no `npm run generate-api` script in mobile yet. Two options:

**Option A — reuse the backend nswag config** (after it has already been run
for web, or with a mobile-targeted nswag.json):
```bash
cd backend
dotnet nswag run nswag.json   # update nswag.json output path to /mobile/src/api/generated.ts
```

**Option B — one-shot for mobile** (if the user wants it scripted, add this to
`mobile/package.json`):
```json
"generate-api": "cd ../backend && curl -sk https://localhost:5001/swagger/v1/swagger.json -o swagger.json && dotnet nswag run nswag.json"
```
Ask before adding the script — it requires deciding whether web and mobile
share one `nswag.json` or each has its own output path.

## After regeneration

1. **Do NOT hand-edit `generated.ts`.** The PreToolUse hook
   `block-generated-edits` will reject any attempt.
2. **Lockfile sanity check** (before any other step):
   ```bash
   git status web/package-lock.json mobile/package-lock.json
   ```
   Both must be untouched. If either drifted, restore from `develop` before
   proceeding (see "Lockfile safety" warning above).
3. Type-check the consumer:
   - web: `cd web && npx tsc --noEmit`
   - mobile: `cd mobile && npx tsc --noEmit`
4. Fix breakage in wrapper modules (`src/api/*.ts`) — rename imports,
   update mapping functions, adjust Zod schemas.
5. Search for call sites: `grep -rn "<old name>" src/`.
6. If the regen produced no diff, the contract change did not actually change
   the Swagger output — double-check the backend work.

## Who runs this

- **`web-react` sub-agent** runs it for `/web` when a backend contract
  affects web call sites. The npm script also writes `swagger.json` into
  `/backend` as a side-effect of curling Swagger — that's expected and not a
  boundary violation for regen purposes.
- **`mobile-expo` sub-agent** runs it for `/mobile` when a backend contract
  affects mobile call sites.
- **Orchestrator** runs it directly only when the backend change needs no
  client work afterwards (e.g. a contract tidy-up with no wrapper changes),
  or when coordinating both clients at once is easier than two handoffs.

## When NOT to run

- The backend change is internal only (private service, test helper, migration
  with no API surface change). Skip the regen.
- The backend hasn't been rebuilt since the change — run `dotnet build` first
  or restart the backend, otherwise Swagger returns stale output.

## Checklist

- [ ] Backend running on :5001 with fresh build
- [ ] `node_modules/` populated (use `npm ci` if not — never `npm install`)
- [ ] `npm run generate-api` succeeds in `/web`
- [ ] Mobile regeneration performed (if the change affects mobile)
- [ ] **`git status` shows zero diff on `web/package-lock.json` + `mobile/package-lock.json`**
- [ ] `tsc --noEmit` clean in both clients
- [ ] Wrapper modules updated where needed
- [ ] No hand-edits in `generated.ts` (hook will block these anyway)
- [ ] `package.json` not in the regen commit (treat regen as client-types only)
