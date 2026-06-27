# Rules: Verification surfaces

What `qa-tester` runs (and dev agents must self-check) before the AC
gate. Cite the relevant anchor when reporting verification status in a
handoff JSON.

## Backend

- `dotnet build` (build must be clean).
- `dotnet test` — Testcontainers-backed integration tests; **Docker
  required**. The relevant slice for the changed feature, OR full
  suite if the change crosses features.

Two parallel runtime surfaces exist:

- **Interactive dev API** at `https://localhost:5001` — owned by
  `dotnet run`, used by the Vite proxy for web smoke. Started by the
  developer (or orchestrator) on demand.
- **Compose harness** at `https://localhost:5101` — `npm run e2e:up`
  brings up the packaged backend + seeded fixture. Used for direct
  curl probes and the iOS-Simulator dev-client. See
  `docs/testing/e2e-fixtures.md` for fixture credentials.

Both can run simultaneously (different ports + DBs).

## Web

- `npm ci` when the lockfile changed.
- `npm run build` — typecheck is part of the build.
- `npm run lint` (`eslint .`) — **required, and distinct from the build.**
  `npm run build` runs only `tsc -b && vite build`; it does NOT run
  ESLint, so lint-only **errors** (e.g. `react-hooks` rule violations like
  setState-in-effect) pass the local build and the QA gate but fail the
  CI `build-and-lint` job. Dev agents and `qa-tester` must run `npm run
  lint` and confirm **0 errors** (pre-existing warnings are acceptable;
  do not introduce new errors). This mirrors the CI `build-and-lint` job
  so lint regressions are caught before push, not on the PR.

For interactive AC checks `qa-tester` boots `npm run dev:e2e` on `:5173`
(the Vite variant whose proxy points at the compose harness on `:5101`)
and drives the touched routes through the Playwright MCP plugin.
**Playwright and MCP Playwright must always target the compose harness
on `:5101`, never the interactive dev API on `:5001`** — the dev API
shares a database with day-to-day development and gets polluted by
test data. The harness is wiped to a deterministic seed via
`POST /test/reset` before each Playwright run (called from
`web/tests/e2e/global-setup.ts`).

Durable e2e specs live at `web/tests/e2e/**` and run against the
compose harness via `npx playwright test` (or `npm run test:e2e`).
Per-issue `.qa-artifacts/<N>/` scripts are deprecated for new work —
graduate ad-hoc evidence specs into the durable suite once they're
worth keeping.

## Mobile

- `npm ci` when the lockfile changed.
- `npx tsc --noEmit` — typecheck.
- `npx expo-doctor` — verifies SDK compatibility, project config
  drift, plugin chain health, and package version mismatches against
  the SDK's expected pins.

For interactive AC checks `qa-tester` boots `npx expo start --web` and
drives the `react-native-web` render through Playwright. **Same rule
as web — point Playwright at the compose harness on `:5101`, never
`:5001`.** Native-only ACs (MMKV, haptics, camera, native nav
transitions, platform pickers) stay on XcodeBuildMCP — `qa-tester`
boots an iOS Simulator and installs the cached dev-client `.app`
produced by `mobile/scripts/qa-build-dev-client.sh` (sha-cached).

## Docs-infra

File diff. Workflow dry-run where possible (`act` or
`gh workflow run --ref` in a sandbox).

## Reporting verification in handoffs

Dev agents declare their own verification result in their handoff
JSON's `verification` field — see
[`schemas/dev-handoff.v1.json`](../schemas/dev-handoff.v1.json). The
shape is constrained:

- `tool` — one of `dotnet-build`, `dotnet-test`, `web-build`,
  `web-lint`, `web-typecheck`, `mobile-typecheck`,
  `mobile-prebuild-check` (the last now maps to `npx expo-doctor` after
  #314; schema enum value kept stable so archived handoffs still
  validate). `web-lint` maps to `npm run lint` (`eslint .`) and is a
  **separate** required check from `web-build` — the verification field
  holds one `tool`, so a web change that needs both reports `web-lint`
  as its declared check after confirming `web-build` also passed (note
  the build result in `notes`/summary). Lint must be **0 errors**.
- `filter` — optional, regex-validated **fully-qualified class name**
  for `dotnet-test` (no quotes/whitespace/shell metacharacters). Used
  with xUnit v3 + Microsoft.Testing.Platform's `--filter-class`
  option, which requires the FQN (`FitnessPlatform.Tests.Services.PhotoDescriptionBackfillServiceTests`
  — NOT the short form `PhotoDescriptionBackfillServiceTests`, which
  silently matches zero tests). Substituted into the canonical
  invocation `dotnet test -- --filter-class <filter>`; the leading
  `--` separator is required by `dotnet test` to forward the option
  to MTP rather than swallowing it. The legacy `--filter
  "FullyQualifiedName~..."` VSTest syntax is silently ignored under
  MTP 1.9.1 (the project's runner) — `warning MTP0001` surfaces only
  for VSTest-specific MSBuild properties, not for the CLI filter
  argument, so callers used to assume the old syntax worked.
- `passed` — boolean.

`qa-tester` substitutes these into a fixed template — never builds raw
shell strings from the dev agent's claim.
