# qa-tester — Design-fidelity procedure (step 5)

> On-demand section of `.claude/agents/qa-tester.md`, moved verbatim (#1214).

A screen is **redesigned** when the issue names its redesign board, or the
dispatch says the screen is built to the redesign. A **new** screen is one the
diff adds. A change to an existing screen that is neither (a bug fix on a
screen not yet rebuilt to the redesign) is **not applicable**: report
"Screen not yet redesigned — fidelity check not applicable" and do not FAIL on
divergence from a board.
If the snapshot README's canvas version is older than the version the
dispatch names, report that before comparing.

For each board from step 1, in **both** themes (web `…C` light / `…D` dark,
mobile `…Light` / `…Dark`):

1. **Read the board's HTML** — the exported file under
   `docs/prototypes/formup-redesign/<web|mobile-light|mobile-dark|coach-light|coach-dark>/`
   (or its source `source/project/<Board>.dc.html`). Extract:
   - semantic structure (header / sections / tabs / cards / CTAs in
     document order)
   - design-token usage (colors, spacing, radii, typography classes)
   - copy (every visible label and CTA — exact text)
   - states visible in the scene (empty / loading / error / filled)

2. **Render the actual component through Playwright.**
   - **Web boards** (`Page…`, exported under `web/`) —
     - `navigate` to `http://localhost:5173/<route-from-the-branch>`.
     - Snapshot the accessibility tree.
     - Screenshot to `.qa-artifacts/<issue>/rendered-<scene>.png`.
     - Also navigate to the board's exported file
       `file://<abs-path>/docs/prototypes/formup-redesign/web/<file>.html`
       (and the dark twin).
     - Snapshot that accessibility tree too.
     - Screenshot to `.qa-artifacts/<issue>/prototype-<scene>.png`.
   - **Mobile boards** (`Glass…`, `Coach…`, exported under `mobile-*/`, `coach-*/`) — same pattern against Expo web:
     - `navigate` to the Expo web URL at the route implemented by the
       branch (read from Expo's startup log — typically
       `http://localhost:<expo-port>/<route>`).
     - Snapshot accessibility tree + screenshot.
     - Also open the board via `file://…/docs/prototypes/formup-redesign/<mobile-light|coach-light>/<file>.html` (and the `-dark/` twin): `Glass…` boards live under `mobile-*/`, `Coach…` boards under `coach-*/`.
     - Snapshot accessibility tree + screenshot.
     - If the component uses an Expo-web-unsafe primitive (see
       caveat list in the Playwright section), note it and attach a
       simulator-screenshot request to the verdict in addition to the
       web render.

3. **Diff the two accessibility trees / code, token-by-token.** Not
   pixel-by-pixel.
   - Colors & spacing MUST come from tokens — the theme hook in mobile (once the mobile app has design tokens),
     Tailwind theme classes in web. A hex in the component that isn't
     in the scene's token list is an automatic fail.
   - Brand accent `#c9a84c` (gold) must only appear via the theme
     entry, never inline.
   - Structural order must match: header → tabs → list → CTA in the
     same order as the scene. Reordering is a fail unless the AC
     explicitly calls it out.
   - Every visible label in the scene must exist as an i18n key in
     the component (`t('…')` / `useTranslation`), and that key must
     resolve in `cs`, `en`, and `de`.
   - States promised by the scene (empty state, loading skeleton,
     error) must be present in the component or already covered by a
     parent screen — missing states are a fail.

4. **When the difference is inherently visual** (spacing that reads
   wrong, a shadow, a curve, a transition), code alone cannot prove
   parity. First try the automated path:

   - Invoke `Skill: playwright-skill:playwright-skill` with the
     visual-regression recipe — capture the current render of every
     route the AC exercises (web at `:5173`, Expo web at the port from its startup output
     for `react-native-web` AC flows) and diff each against its
     stored baseline at `.qa-artifacts/baselines/<scene>-<route>.png`
     (one baseline per (scene, route) pair, kept globally
     cross-issue — the whole point of a regression baseline).
   - **No drift on every route** → criterion ✅ PASS; no human
     eyeball needed.
   - **Drift detected on any route** → attach the diff PNG plus both
     screenshots from step 2 to the verdict, mark the criterion ⚠️
     UNVERIFIED — REQUIRES HUMAN REVIEW, and ask the orchestrator
     to get the user to eyeball them. Do not PASS on a visual claim
     you can't prove.
   - **No baseline yet for a (scene, route) pair** → DO NOT
     auto-adopt the current render; a silent first-run adoption
     would bake in any regression the dev shipped. Attach the
     candidate PNG to the verdict, mark the criterion ⚠️ UNVERIFIED
     — REQUIRES HUMAN BASELINE APPROVAL, and ask the orchestrator
     to get the user to confirm the render is correct before
     committing it as `.qa-artifacts/baselines/<scene>-<route>.png`.
     Future runs diff against it.

   Baselines stay local-only by default — `.qa-artifacts/` is
   gitignored repo-wide. Lift the gitignore rule for
   `.qa-artifacts/baselines/` to share baselines across machines / CI.
