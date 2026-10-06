# qa-tester — iOS Simulator path (PAUSED)

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

> **PAUSED since #1160.** The mobile app was regenerated from scratch, so
> `mobile/scripts/qa-build-dev-client.sh`, `qa-fetch-refresh-token.sh` and the
> `e2e-auth` deep-link handler no longer exist. Do not run this path. For a
> native-only AC, report it ⚠️ UNVERIFIED with `iOS path paused (#1160)`; for
> mobile typecheck/doctor, use the `mobile` row of the static checks as usual.
> The steps below are kept unchanged for when the new app has a sign-in
> screen; restore the scripts from git (`git show 6c625108^:mobile/scripts/<name>`)
> and re-add the deep-link handler then.

For native iOS ACs you can take all the way to "app launched +
authenticated on Today screen, logs clean" using only `xcrun simctl`
(in your allowlist) and the helper scripts. Anything past that point
— tapping a card, asserting visual layout, exercising a gesture —
flips the verdict to `INTERACTIVE-REQUIRED` and the orchestrator
picks up via the playbook in `.claude/CLAUDE.md` rule 6.5.

The flow is:

1. **Build (or reuse) the dev-client `.app`.**
   ```bash
   APP=$(mobile/scripts/qa-build-dev-client.sh)
   ```
   The script keys the cache on `git rev-parse HEAD:mobile`. Cache hit
   returns in <1s; cold build takes 5–8 min on first run (one-off cost,
   document this in the verdict's boot order so the orchestrator
   doesn't surface it as a regression). The script handles
   `expo prebuild --no-install` automatically when `mobile/ios/` is
   missing.

2. **Pick the simulator** via `xcrun simctl`:

   ```
   xcrun simctl list devices booted --json
   ```

   Resolve a target by this precedence:

   1. **A simulator already in `Booted` state** — use it as-is. The user
      typically keeps one simulator running; reusing it preserves
      their session, avoids a cold boot, and means teardown leaves it
      booted (see step 8). If multiple are booted, prefer the one whose
      `name` matches `.xcodebuildmcp/config.yaml`, else the one with
      the newest iOS runtime.
   2. **A `Shutdown` simulator matching `name` in `.xcodebuildmcp/config.yaml`** —
      boot it via `xcrun simctl boot <udid>`. This is the config-pinned default.
   3. **Any installed iPhone simulator** — `xcrun simctl list devices available --json`
      to enumerate; pick the one with the newest iOS runtime (tie-break:
      alphabetical device name) and `xcrun simctl boot <udid>`.
      Record `simulator auto-selected: <name> (iOS <ver>) — config
      pin "<configured>" not installed` in the verdict's tooling
      section so the user sees the substitution.
   4. **No iPhone simulator installed at all** — degrade to ⚠️ UNVERIFIED
      — REQUIRES USER SIMULATOR with the message
      `No iOS simulator installed; add one via Xcode → Settings → Platforms`.

   Capture the chosen simulator's `udid` + `name` and whether it was
   `pre-booted` vs. `freshly-booted` — both feed into the teardown
   rule (step 8).

3. **Install + launch** via `xcrun simctl`:
   ```
   xcrun simctl install booted "$APP"
   xcrun simctl launch booted com.gfplatform.mobile
   ```
   `booted` resolves to the booted simulator from step 2. If multiple
   simulators are booted, replace with the explicit `<udid>`.

3a. **Bypass the login screen via deep link.** The dev-client always
   launches to the login screen on cold install. Driving the login form
   via `tap` + `type_text` is fragile (placeholder reflows, keyboard
   covers fields, autofill banners). Instead, fetch a seeded refresh
   token from the compose harness and inject it via the
   `__DEV__`-gated deep-link handler in `mobile/app/_layout.tsx` (added
   for #288):

   ```
   T=$(mobile/scripts/qa-fetch-refresh-token.sh client)
   xcrun simctl openurl booted "fitnessplatform://e2e-auth?token=$T"
   ```

   The handler writes the token to MMKV and calls `restoreSession()`.
   The home screen MUST be visible within ~3 s. If it isn't:
   - Capture the actual landing screen via `screenshot` to
     `.qa-artifacts/<issue>/sim-after-deeplink.png`.
   - Read the simulator log (step 6) and grep for `[e2e-auth] login
     bypass invoked` to confirm the handler fired.
   - If the log line is missing, the build doesn't include the
     handler — likely a stale `.qa-cache` `.app`. Force rebuild via
     `mobile/scripts/qa-build-dev-client.sh --force`.
   - If the log line is present but the screen didn't change,
     `/auth/refresh` likely returned non-200 — diagnose via the
     simulator log + a curl probe against `:5101/auth/refresh`.
   Surface either of the above as ⚠️ PARTIAL with `auth-bypass: fail`
   in the verdict's tooling section. Do not fall back to tap-driven
   login — it has its own failure mode list that's not worth working
   around.

   Use `trainer` / `nutritionist` instead of `client` for ACs that
   require a different role's vantage.

4. **Point the dev build at the compose API.** The fixture lives at
   `https://localhost:5101` (intentionally distinct from the
   interactive dev API on `:5001` so both can run simultaneously). The
   mobile axios client honours `EXPO_PUBLIC_API_BASE_URL` — so a dev
   build produced with
   `EXPO_PUBLIC_API_BASE_URL=https://localhost:5101
   mobile/scripts/qa-build-dev-client.sh` is already wired correctly.
   When the variable is absent the build defaults to
   `http://localhost:5000` (HTTP dev) — that doesn't reach the compose
   stack, so always set the env var when you need fixture state. The
   simulator's `localhost` resolves to the macOS host, which means it
   reaches the compose-published port directly without bridge tricks.

5. **Drive the flow — DEFER TO ORCHESTRATOR.** The MCP UI-automation
   tools (`mcp__xcodebuildmcp__tap` / `type_text` / `swipe` /
   `snapshot_ui` / etc.) **do not propagate to your sub-agent
   dispatch** — see "Tool-surface reality" at the top of this file.

   If an AC requires post-auth interactive drive (tapping a button,
   typing into a field, navigating between screens, asserting a
   visual state that auth-bypass alone doesn't reach), record the AC
   as `met: false` with a precise `evidence` note that names:
   - the starting state (e.g. "Today screen, post-deep-link auth"),
   - the exact interaction needed ("tap the workout card labelled
     '<title>', scroll to the timer hero, assert no overlap"),
   - the expected visual outcome (with the redesign board name, e.g.
     `PageTemplateDay`, and its exported file under
     `docs/prototypes/formup-redesign/`),
   - the artefact path the orchestrator should produce (e.g.
     `.qa-artifacts/<issue>/sim-after-tap-workout.png`).
   Then set the OVERALL `verdict` to `INTERACTIVE-REQUIRED`. The
   orchestrator's interactive QA playbook in `.claude/CLAUDE.md`
   picks up from there.

   Do NOT substitute MCP `tap` with `osascript`, AppleScript, key-event
   injection via `xcrun simctl spawn keyboard`, or other host-level
   automation — those bypass the agent sandbox, are non-reproducible,
   and burn dispatch budget for results we cannot trust.

6. **Capture evidence.** Screenshot to
   `.qa-artifacts/<issue>/sim-<scene>.png` (the directory is gitignored
   already). Read the simulator log via Bash (XcodeBuildMCP v2.5.2
   does not expose a plain "read log" MCP tool — log access goes
   through `xcrun simctl`):
   ```
   xcrun simctl spawn booted log show --last 60s --predicate \
     'subsystem == "com.gfplatform.mobile"' --style compact
   ```
   Grep the output for `error`, `Reanimated`, unhandled-promise
   warnings, or any other runtime fault — a green AC on a screen that
   is logging a `JSExceptionHandler` warning is still a fail.

7. **Smoke probe — wired end-to-end (bash-only surface).** As part of
   every dispatch that exercises the iOS path:
   - launch the dev-client (step 3),
   - inject auth via the deep-link bypass (step 3a) with role `client`,
   - take a screenshot via `xcrun simctl io booted screenshot
     .qa-artifacts/<issue>/sim-after-deeplink.png`,
   - verify the auth handler fired:
     ```
     xcrun simctl spawn booted log show --last 30s --predicate \
       'subsystem == "com.gfplatform.mobile"' --style compact \
       | grep "\[e2e-auth\] login bypass invoked"
     ```
   If the log line is present AND the screenshot is NOT the login
   form, smoke passes — auth bypass mechanism works. Final visual
   "Today screen renders cards" assertion is part of the
   INTERACTIVE-REQUIRED handoff if any AC depends on it.

   If the smoke probe fails (log line absent, or screenshot still on
   login), the iOS path is broken — surface that as a tooling problem
   ("iOS smoke probe failed"), not as an AC failure. Route to the
   orchestrator rather than blaming the dev agent.

8. **Tear down in step 7** (the agent-level "Tear down" step at the
   end of the workflow). Behaviour depends on how step 2 selected the
   simulator:
   - **Pre-booted** (the user's existing running simulator) → uninstall
     the dev-client `.app` but **leave the simulator booted**. Shutting
     down a sim the user was using disrupts their workflow.
   - **Freshly-booted** by qa-tester → `xcrun simctl shutdown <udid>` AND uninstall
     the `.app` you installed. Never leave a qa-tester-booted simulator
     running across dispatches because the next run's `install_app`
     then collides on a stale install.
   In both cases, terminate the running app process so re-launches are
   clean.

If XcodeBuildMCP isn't available in the sub-agent environment (plugin
not loaded, Xcode missing, simulator runtime not installed), record
`XcodeBuildMCP unavailable on this host` in the verdict's tooling
section and degrade to ⚠️ UNVERIFIED — REQUIRES USER SIMULATOR for
each native-only criterion. Same shape as the Playwright degradation.
