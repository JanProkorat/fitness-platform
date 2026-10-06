# qa-tester — Backend boot, two parallel surfaces

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

Two distinct backend surfaces, on **different ports**, that you may
need at the same time:

| Surface              | Port                       | Owns the port             | Use when…                                                     |
|----------------------|----------------------------|---------------------------|---------------------------------------------------------------|
| Interactive dev API  | `https://localhost:5001`   | the user's `dotnet run`   | web smoke through the Vite proxy (proxy hardcoded to :5001)   |
| Compose harness      | **ephemeral** — read `./scripts/test-env ports` | `npm run e2e:up` | HTTP probes against seeded fixture (Playwright request context, not curl); iOS Simulator path paused (see PAUSED notice) |

The compose harness (`docker-compose.test.yml`) boots a packaged
backend plus a deterministic fixture (seeded users — see
`docs/testing/e2e-fixtures.md`). The interactive dev API is whatever
the user has running (no fixture, throwaway accounts via
`/auth/register`).

Boot order (still skipping any surface that's already responding):

1. **Compose harness on `:5101`** — probe
   `curl -ksS https://localhost:5101/swagger/v1/swagger.json` first.
   If nothing answers:
   ```bash
   npm run e2e:up
   ```
   Compose builds (cache-hot ≈30s, cold ≈3 min), runs the seed
   container to completion, then starts the API. Poll
   `https://localhost:5101/swagger` every 2s up to 90s (compose adds
   build time to the existing 60s ceiling).

   If `npm run e2e:up` fails (Docker not running, port `:5101` owned
   by another process, image build error), record "compose
   unavailable" in the verdict's boot order. Native-only ACs then
   mark ⚠️ UNVERIFIED — REQUIRES COMPOSE; backend curl probes degrade
   to the dev API on `:5001` if it's up.

   Tear down with `npm run e2e:down -v` (the `-v` drops the volumes
   so the next run starts clean).

2. **Interactive dev API on `:5001`** (only if the touched ACs need
   the Vite proxy — i.e. web smoke flows). Probe
   `curl -ksS https://localhost:5001/swagger` first. Verify the
   Swagger signature before reusing it (a stray dotnet from another
   repo would happily serve 200 and then 404 every Playwright probe).
   If absent:
   ```bash
   cd backend/FitnessPlatform.Application
   dotnet run &
   ```
   Poll up to 60s. The whole stack (Vite proxy, web client axios
   base URL, SignalR hub) is hardcoded against `:5001` — don't try a
   different port here. If the port is occupied by something other
   than FitnessPlatform, fail fast with ⚠️ UNVERIFIED — port :5001
   in use; ask the orchestrator to surface "stop the other process
   on :5001" to the user.

3. **Web dev server** — unchanged.
4. **Expo web** — unchanged.

## Step 3b boot order (short version, moved verbatim)

A backend must be up before Vite or Expo web is useful. Two parallel
backend surfaces — see the dedicated "Backend boot — two parallel
surfaces" doc (`.claude/docs/agents/qa-tester/dev-server-boot.md`) for the full table. Short version:

- Vite proxies `/auth`, `/users`, `/trainer`, `/nutrition`, `/training`,
  `/hubs`, etc. to `https://localhost:5001` — that's the **interactive
  dev API** owned by `dotnet run`.
- The compose harness lives on `https://localhost:5101` — used for
  curl probes against the seeded fixture and for the iOS Simulator
  dev-client (which builds with `EXPO_PUBLIC_API_BASE_URL=https://localhost:5101`).

Boot order, **skipping any surface that's already responding**:

1. **Compose harness on `:5101`** (whenever `mobile` is in scope or the
   AC needs seeded fixture data) — probe
   `curl -ksS https://localhost:5101/swagger/v1/swagger.json`. If
   absent, `npm run e2e:up` and poll up to 90s. See "Backend boot —
   two parallel surfaces" (`.claude/docs/agents/qa-tester/dev-server-boot.md`) for the full degradation logic.
2. **Interactive dev API on `:5001`** (only when `web` is in scope —
   the Vite proxy hardcodes this port) — probe
   `curl -ksS https://localhost:5001/swagger` first. If 200, verify
   it's actually FitnessPlatform by fetching
   `https://localhost:5001/swagger/v1/swagger.json` and grepping for
   `/auth/login`, `/trainer/clients`, `/nutrition/plans`. Signature
   match → reuse. Foreign API → fail fast ⚠️ UNVERIFIED (do **not**
   kill the other process, do **not** try a different port).
   If absent:
   ```bash
   cd backend/FitnessPlatform.Application
   dotnet run &   # run_in_background via Bash
   ```
   Poll up to 60s; timeout → ⚠️ UNVERIFIED — BE didn't start.
3. **Web dev server** (only if `web` is in scope) — probe
   `curl -sS http://localhost:5173` first. If up, reuse. Otherwise
   `cd web && npm run dev &`, poll until 200 (up to 30s).
4. **Expo web** (only if `mobile` is in scope) — probe the expo web
   port (default 8081; confirm from Expo's startup output).
   If not up, boot with the no-popup flags so your host's default
   browser doesn't auto-open and interrupt the user:
   ```bash
   cd mobile && EXPO_NO_OPEN=1 BROWSER=none \
     npx expo start --web --no-dev-client &
   ```
   Poll until the web bundle responds (up to 60s — Expo web is slow
   on first boot). Playwright drives the browser headless from there
   — no host browser window is needed for QA.

   Vite (`npm run dev`) does not auto-open by default in this repo;
   no extra flags needed there.
