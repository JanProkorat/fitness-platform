# qa-tester — Accessibility pass (step 5b)

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

After step 4's per-criterion verification finishes, run the axe-core
MCP against every web (`:5173`) and Expo web (port from its
startup output, `react-native-web`) route the AC exercised. Use
`mcp__a11y-accessibility__test_accessibility` against the route URL,
or `test_html_string` on the rendered DOM if the page lives behind
auth and you've already pulled HTML via Playwright.

If the diff touches **prototype scenes** under `docs/prototypes/**`
(also user-facing HTML), audit them too — load each touched scene via
`file://` and run `test_accessibility`, or read the file and pipe its
contents to `test_html_string`. Same severity classification as web /
Expo-web flows.

Skip the pass when, and only when:

- The diff has zero `/web`, `/mobile`, or `docs/prototypes/**` UI
  changes (pure backend / non-prototype docs / config PR).
- All ACs in step 4 came back ⚠️ UNVERIFIED for missing-tooling
  reasons (Playwright unavailable etc.) — accessibility can't be
  tested either; flag both in the verdict.
- The orchestrator's brief explicitly says skip a11y (rare; flag in
  the verdict so the user sees the skip).

Classify findings by axe severity:

- **`critical` / `serious` violations** → AC fail. Add a per-route
  bullet under "Additional findings (not in the AC but blocking)"
  with the rule (`color-contrast`, `aria-required-attr`, etc.) and
  the offending selector. Do not PASS the AC even if every step-4
  criterion individually passed.
- **`moderate` / `minor` violations** → surface as NIT under
  "Additional findings (non-blocking)". Don't fail the run.
- **No violations** → one-line note in the verdict
  (`a11y: 0 violations across <N> routes`).

Use `check_color_contrast` directly when the AC mentions a contrast
spec, and `check_aria_attributes` when introducing a new interactive
component (combobox, dialog, tab, listbox).

Tool prefix: `mcp__a11y-accessibility__*` — load via ToolSearch with
`select:mcp__a11y-accessibility__test_accessibility,mcp__a11y-accessibility__test_html_string,mcp__a11y-accessibility__check_aria_attributes,mcp__a11y-accessibility__check_color_contrast,mcp__a11y-accessibility__check_orientation_lock,mcp__a11y-accessibility__get_rules`
if missing from the initial list.

If the MCP isn't reachable in the agent's environment, say so
explicitly in the verdict (`a11y-accessibility unavailable —
accessibility pass skipped`). Do not mark ACs PASS while silently
skipping the pass — record the skip so the user sees it.
