# Web portal v1 rebuild — design

**Date:** 2026-09-14
**Branch:** `feature/ui-redesign` (epic branch)
**Scope:** `/web` only. No backend and no mobile changes.

---

## 1. Purpose

Rebuild the trainer/nutritionist portal from scratch against the
`⚡Wireframe` page of the Figma file
`Qi8EpYD2b0e717hvi2bbVq`, shipping one page at a time.

The strip already happened: commit `1ecb68ae` (2026-07-17) deleted every
component and page under `web/src`, keeping `api/`, `lib/`, `hooks/`,
`stores/auth.ts`, `routes/`, `i18n/` and `App.tsx`. Nothing further needs
deleting.

### Out of scope for v1

The wireframe covers 63 desktop frames. v1 covers five feature areas.
The following appear in the wireframe and are **not** being built now,
because they have no backend feature folder behind them:

| Wireframe area | Backend today |
|---|---|
| Automations | nothing |
| Storage | nothing (MinIO exists, no feature slice) |
| Forms | `Questionnaires` — related, not the same |
| Metrics | `ClientMeasurements` — related, not the same |

Also out of scope: training plans, exercises, templates, and every mobile
screen. The wireframe has **no mobile frames at all**, so the "one shared
design language for web and mobile" goal recorded on this branch is only
half-covered by this file. Mobile is a separate future effort.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Component base | shadcn/ui on Tailwind 4 | Copy-owned components, styled from CSS variables. Drawer-heavy screens (ingredients, recipes) come close to free. Adds Radix packages — approved by the user on 2026-09-14. |
| Visual direction | Placeholder palette behind named tokens | Colors and fonts are not final. Every value is a CSS variable so the eventual brand is a one-file change. |
| Locales | `cs`, `en`, `de` — all three, every commit | Existing locale files survived the strip. A catch-up pass later would mean revisiting every component. |
| Testing | Playwright end-to-end, one spec per page | Harness and auth setup already exist under `web/tests/e2e/`. No Vitest layer in v1. |
| Integration | `feature/ui-redesign` acts as the epic branch | Sub-issue PRs base on it and auto-merge; `develop` receives one authorized merge at the end. |
| Naming | Screens/URLs/copy follow Figma; API modules keep backend names | Figma says Ingredients / Inbox / Mealplans; backend says Foods / Messaging / NutritionPlans. The `api/` layer is the single translation point. |

---

## 3. Design tokens

Read out of Figma (`get_design_context` on nodes `1:373`, `1:275`,
`1:394`). The file defines no Figma variables, so these are the literal
values the wireframe uses.

| Token | Value | Used for |
|---|---|---|
| `--ink` | `#0f172a` | primary text, headings |
| `--ink-2` | `#334155` | secondary text |
| `--muted` | `#64748b` | labels, inactive nav, section headers |
| `--faint` | `#94a3b8` | placeholder text |
| `--line` | `#e2e8f0` | borders, hairlines |
| `--paper` | `#f8fafc` | page ground, text on dark |
| `--surface` | `#ffffff` | cards, panels |
| `--pill` | `#1e1e22` | active nav item, dark CTA |
| `--green` | `#15803d` | primary action, accents |
| radius | `6px` small, `8px` medium | nav items / inputs and buttons |
| type | Inter — 400/500/600/700 | everything |

Scale observed: page title 28px bold, body and controls 13px, section
label 10px uppercase with wide tracking.

Icons in the wireframe are **Lucide** (`users`, `message-square`, `cpu`,
`folder`, `chevron-down`, `search`, `bell`, `log-out`). Use `lucide-react`
rather than exporting SVGs.

**Rule:** no hex, rem-magic-number, or font-family literal may appear
outside the token file. A hardcoded value that happens to be correct is
still a blocking review finding — it desyncs from the token the next
theme change will not reach.

---

## 4. Phase 0 — foundation

Runs before any page. One issue, one PR.

1. **Rebase `feature/ui-redesign` onto `develop`.** The branch is 85
   commits behind. Conflicts should be minimal — the `web/` UI files that
   would conflict are already deleted.
2. **Regenerate the API client** (`npm run generate-api`) and audit the
   ~60 surviving `api/*.ts` modules against it. They were written against
   July's backend; since then photo endpoints merged into `ClientPhotos`
   (#1043), computed nutrition targets moved to their own table (#1048),
   and a Mongo collection was renamed (#1044). Any module calling a route
   that no longer exists is fixed here, before anything is built on it.
3. **Install shadcn/ui** and its Radix dependencies.
4. **Write the token file** — the table in §3, as CSS variables in
   `index.css`.
5. **Build the app shell** — sidebar, top bar, routing. The existing
   `routes/ProtectedRoute.tsx`, `routes/RoleGuard.tsx` and `stores/auth.ts`
   are reused unchanged.
6. **Wire the first Playwright spec** so the harness is proven before it
   is depended on.

**Verification:** `npm run build` green, one Playwright spec green,
`api/generated.ts` regenerated and committed.

---

## 5. Build order

Nine pieces, each a sub-issue of the v1 epic. Order is forced in two
places: recipes need ingredients, and nutrition plans need both plus a
client.

| # | Page | Notes |
|---|---|---|
| 1 | Entry `/` + login | Design approved 2026-09-14 (§6). |
| 2 | Register, email verify, password reset | No Figma design. Prototype first, same process as page 1. Old flow was four steps. |
| 3 | Clients list + invite | Wireframe `client-list-01`…`07`. Tabs, filter chips, table, tags, pagination. |
| 4 | Client detail | Wireframe `client-overview`, `client-development`. |
| 5 | Inbox + chat | Wireframe `inbox-state-05`…`12`. SignalR live messages; `hooks/useSignalR.ts` survives. |
| 6 | Ingredients — list + create/edit/detail drawer | Wireframe `ingredients-01`/`02`. Backend: `Foods`. |
| 7 | Recipes — list + create/edit/detail drawer | Wireframe `recipes-state-01`/`02`. |
| 8 | Nutrition plan — create, read, update, delete | Wireframe `client-nutrition-01`…`08`. The largest piece; the stripped version was 28 components. |
| 9 | Nutrition plan — publish by week | Publishing is week-level, with its own optimistic-concurrency rules. Separated so its logic gets its own review. |

Messaging stays at position 5 at the user's request, ahead of the
databases.

---

## 6. Page 1 — entry page

**Route:** `/`, no prefix. An authenticated visitor is redirected to the
clients list and never sees it. An unauthenticated visitor gets the
marketing entry page with the login panel.

**Layout:** two columns. Left column scrolls and carries the hero plus
the marketing sections. Right column is a 440px login panel, pinned
(`position: sticky`, full viewport height) so it does not move while the
left scrolls. A GF medallion sits on the seam, pinned to the viewport.
Below 960px the grid collapses to one column, the panel unpins, hero
first.

**Content:** hero headline with one Fraunces italic accent word against
Inter; four capability chips; a five-cell photo collage; then three
marketing sections (what the platform does / for coaches / for clients)
and a closing call to action.

**Login panel:** email, password with reveal, keep-me-signed-in, forgot
link, primary sign-in button, Google and Apple, create-account link,
CS/EN/DE switch.

**Approved prototype:**
- Artifact — https://claude.ai/code/artifact/1e592806-bed9-47f2-8f31-131469519347
- Source — `scratchpad/gf-entry.html` (gitignored, self-contained)

**Deliberately left open**, to settle when the brand lands:
- headline line breaks are set by measure, not by hand
- the collage cells are dashed placeholders; no photography exists yet
- Fraunces is a prototype choice for the accent word, not a locked face
- the final palette replaces the placeholder values in §3

---

## 7. Definition of done, per page

A page is not done until every line below is true.

- Renders against the compose test harness with real data, not fixtures
  hand-written in the component.
- Empty, loading and error states exist and were looked at — not only the
  happy path.
- Every user-visible string exists in `cs`, `en` and `de`. A missing key
  in any locale is a blocking finding.
- No colour, spacing, radius or font value outside the token file.
- No `any`, no `@ts-ignore`, no edit to `src/api/generated.ts`.
- Server reads through `useQuery`, writes through `useMutation`. No
  `fetch` inside `useEffect`. Query keys are arrays, most-general-first.
- Forms through React Hook Form with a Zod schema.
- `npm run build` passes (typecheck is part of it).
- The page's Playwright spec passes.
- Keyboard reaches every control and focus is visible.

---

## 8. Process per page

1. Issue created with acceptance criteria (`github-issues`).
2. Design review gate before any code (`design-reviewer`).
3. Branch `<type>/<issue>-<slug>` off `feature/ui-redesign`, in its own
   worktree under `.worktrees/`.
4. Build (`web-react`).
5. Acceptance-criteria gate (`qa-tester`) — loop until PASS.
6. Two-pass code review (`pr-reviewer`) — loop until READY FOR MERGE.
7. Auto-merge into `feature/ui-redesign` — no per-page authorization,
   per `rules/merge-strategy.md#sub-issue-auto-merge`.
8. **Stop and wait for the user** before starting the next page.

At the end of v1, one epic PR from `feature/ui-redesign` into `develop`,
merged only on explicit same-turn authorization.

---

## 9. Risks

**The API-module audit in Phase 0 is the biggest unknown.** Sixty modules
were written against a backend that has moved 85 commits. The audit could
be an hour or a day. It is deliberately its own phase so that cost lands
before any page depends on it.

**Page 8 is not one page.** The nutrition plan builder was 28 components.
If it does not fit one reviewable PR once its issue is written, it gets
split then rather than now — splitting it before reading the wireframe in
detail would be guessing.

**The wireframe is a product roadmap, not just a redesign.** Four of its
sidebar areas have no backend. Building them means backend work too, and
that is not in this scope. The v1 sidebar shows only what v1 delivers.
