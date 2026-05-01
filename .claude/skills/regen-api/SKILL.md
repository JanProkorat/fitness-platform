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
2. Type-check the consumer:
   - web: `cd web && npx tsc --noEmit`
   - mobile: `cd mobile && npx tsc --noEmit`
3. Fix breakage in wrapper modules (`src/api/*.ts`) — rename imports,
   update mapping functions, adjust Zod schemas.
4. Search for call sites: `grep -rn "<old name>" src/`.
5. If the regen produced no diff, the contract change did not actually change
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
- [ ] `npm run generate-api` succeeds in `/web`
- [ ] Mobile regeneration performed (if the change affects mobile)
- [ ] `tsc --noEmit` clean in both clients
- [ ] Wrapper modules updated where needed
- [ ] No hand-edits in `generated.ts` (hook will block these anyway)
