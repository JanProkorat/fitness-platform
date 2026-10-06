# qa-tester — External MCP tooling reference

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

The project has three MCP plugins for interactive verification.
**None of these tool namespaces propagate to a qa-tester sub-agent
dispatch** (see "Tool-surface reality" above). They live on the
orchestrator main thread and are driven via the playbook at
`.claude/CLAUDE.md` rule 6.5. This section documents what each plugin
provides so you can write a precise `INTERACTIVE-REQUIRED` evidence
note that tells the orchestrator exactly which tool to reach for:

- **Playwright** (https://claude.com/plugins/playwright, Microsoft) —
  browser automation as `mcp__plugin_playwright_playwright__*` tools
  (navigate, click, fill, screenshot, accessibility tree, console +
  network). Orchestrator uses this for: web portal AC flows; mobile
  AC flows via Expo web (`npx expo start --web` → react-native-web);
  design-fidelity diffs against the redesign boards in `docs/prototypes/formup-redesign/`.
- **XcodeBuildMCP** (https://www.xcodebuildmcp.com/, Sentry) — declared
  in `.mcp.json` with `enabledWorkflows: [simulator, ui-automation]`
  in `.xcodebuildmcp/config.yaml`. iOS Simulator drive as
  `mcp__xcodebuildmcp__*` tools. The `simulator` workflow ships
  boot/install/launch/screenshot/list_sims; the `ui-automation`
  workflow ships tap/type_text/swipe/gesture/button/snapshot_ui/
  long_press/touch/key_press/key_sequence. Orchestrator uses this
  for native iOS flows that can't render under react-native-web:
  MMKV persistence, gesture handlers, `expo-haptics`, `expo-camera`,
  `expo-image-picker`, native push, native nav transitions, platform
  pickers, Reanimated animations.
- **a11y-accessibility** (axe-core wrapper) — accessibility audits as
  `mcp__a11y-accessibility__*` tools: `test_accessibility` (drive a
  live URL), `test_html_string`, `check_aria_attributes`,
  `check_color_contrast`, `check_orientation_lock`, `get_rules`.
  Orchestrator uses this for post-AC accessibility pass on web /
  Expo-web flows.

**What this sub-agent (qa-tester) can still do for web + Expo web:**
- Boot the web dev server (`npm run dev:e2e` on `:5173`) and assert
  via `curl` that routes return non-error responses. This catches
  build-time failures and middleware regressions; it does NOT catch
  client-side render bugs.
- For mobile native flows, the iOS simulator path is PAUSED since #1160
  (see the notice in the iOS Simulator section); flag them
  ⚠️ UNVERIFIED instead.
- Anything beyond "did the screen change" — i.e. asserting specific
  DOM state, tapping a button, typing into a field, asserting visual
  layout — goes into the `INTERACTIVE-REQUIRED` handoff.

**Web spec drive does NOT need this sub-agent.** Durable Playwright
specs (`web/tests/e2e/**`) run via `npx playwright test` (via Bash —
that IS in your allowlist). For ad-hoc orchestrator-driven probes,
the orchestrator loads the Playwright MCP schemas itself.

**Playwright does not help with:**
- Backend API behaviour — use `dotnet test` and `curl` instead.
