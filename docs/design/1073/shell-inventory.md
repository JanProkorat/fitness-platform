# App-shell design inventory — issue #1073

Extracted from Figma file `Qi8EpYD2b0e717hvi2bbVq`, frame `client-list-02`
(node `1:541`) on 2026-09-20. The shell is identical across all seven
`client-list-*` frames, so this one frame is the contract for every v1 route.

Reference renders beside this file:

- `sidebar-frame.png` — the sidebar component on its own (node `1:263`).
- `client-list-02-full.png` — the whole 1920×1200 frame, which is the only
  evidence for "there is no top bar".

Every number below is read off the Figma node tree, not estimated. Where a
value must become a token, the proposed token name is given; **no literal hex,
px or font-family may land outside `web/src/index.css`** (index.css:11).

---

## 1. Layout skeleton

| Region | Node | Geometry |
|---|---|---|
| Sidebar | `1:543` | x 0, width **240**, full viewport height |
| Main content | `1:652` | x 240, fills the rest |

The main column's first child is a **page header** (`1:653` "Topbar"): the page
title `Clients` on the left and a `+ Add client` button on the right, inset
32px from the content edge. It belongs to the page, not to the shell — it is
already built inside `ClientsPage`.

**There is no global top bar.** The frame contains no search field, no bell, no
user name and no logout control anywhere in the main column. The bell lives in
the sidebar's brand row; the user and logout live at the sidebar's foot. This
is AC 4 of the issue.

---

## 2. Sidebar container

| Property | Value | Token |
|---|---|---|
| Background | `#121214` | new — `--gf-sidebar-bg` |
| Width | 240px | new — `--gf-sidebar-width` |
| Padding | 24px block, 16px inline | existing spacing scale |
| Gap between the three blocks | 20px | — |

The three blocks, top to bottom: **Brand**, **Navigation** (grows to fill),
**Bottom-Menu**.

`#121214` is *not* `--gf-pill` (`#1e1e22`). Both appear in the design and they
are different roles: `#121214` is the sidebar ground, `#1e1e22` is the active
nav item sitting on top of it, and the same `#1e1e22` is the hairline above the
profile row. Do not collapse them into one token.

### Colour roles inside the sidebar

| Role | Hex | Already a token? |
|---|---|---|
| Sidebar ground | `#121214` | no — add `--gf-sidebar-bg` |
| Active item fill / profile hairline | `#1e1e22` | yes, `--gf-pill` — expose as `--gf-sidebar-accent` for clarity |
| Primary text on dark (brand, active label, user name) | `#f8fafc` | yes, `--gf-paper` |
| Inactive label, section header, bottom-menu label | `#64748b` | yes, `--gf-muted` |
| User's role line | `#94a3b8` | yes, `--gf-faint` |
| Brand badge fill | `#15803d` | yes, `--gf-green` |

Per the design review: add tier-1 `--gf-sidebar-*` raw tokens and expose them
in `@theme inline` as `--color-sidebar-*`, following how `--gf-pill` is exposed
as `--color-pill` at `index.css:151`. **Do not redefine the tier-2 names**
(`--background`, `--foreground`, `--card`, …) — every `components/ui/**`
primitive reads those globally, so redefining them repaints the whole portal.
Do not run shadcn's `sidebar` block either; it reserves its own `--sidebar`
namespace and would collide.

---

## 3. Brand row (`1:544`)

Space-between, 8px inline padding, 12px bottom padding.

Left group, 8px gap:

- **Avatar badge** 32×32, radius 6px, fill `#15803d`, centred text `GF`
  at 13–14px Inter ExtraBold in `#f8fafc`. The literal `GF` in the design is
  the product's own initials, not the signed-in user's.
- **Name** `GoodFellas` at 13px Inter Bold in `#f8fafc` — this is
  `t('common.appName')`, which is already `GoodFellas` in all three locales.
- A second line `Coachway` exists in the file but is **hidden** (`1:550`) —
  ignore it.

Right: a **bell** icon, 16×16, in `#64748b`. It is inert in v1 (no notification
surface is built); keep it inert and keep its accessible name
`t('notifications.title')`, which the current top bar already uses.

---

## 4. Navigation (`1:554`)

Fills the remaining height. **20px** between sections, **4px** inside a
section.

### Section header

Space-between row, 12px tall:

- Label: 10px Inter SemiBold, **uppercase**, `#64748b` → `text-label` +
  `text-sidebar-muted`.
- A `chevron-down` icon, 12×12, right-aligned — the section is collapsible.

### Nav item

Row, 8px padding, 10px gap, radius 6px (`--gf-radius-sm`), 32px tall:

- Icon 16×16.
- Label 13px (`text-body`).

| State | Background | Label |
|---|---|---|
| Active | `#1e1e22` | Inter **SemiBold**, `#f8fafc` |
| Inactive | transparent | Inter **Medium**, `#64748b` |

The current `Sidebar.tsx:42` uses `bg-pill text-paper` for the active state,
which is already the right pair — the weight change is the missing half.

### Sections and items in the design, in order

| Section header | Items (Figma icon name) |
|---|---|
| CLIENT MANAGEMENT | Clients (`users`), Inbox (`message-square`), Automations (`cpu`), Storage (`folder`) |
| WORKOUTS | Exercises (`activity`), Templates (`file-text`) |
| NUTRITION | Recipes (`book-open`), Ingredients (`columns`), Mealplans (`clipboard`) |
| FORMS | Forms (`file`), Metrics (`bar-chart`) |

### What v1 actually renders

Design spec §9 (`docs/superpowers/specs/2026-09-14-web-v1-rebuild-design.md`)
limits the sidebar to what v1 delivers, and AC 2 of #1073 repeats it: **empty
groups are not rendered.** So two sections survive with two items each:

| Section | Items | Existing route | Existing label key |
|---|---|---|---|
| CLIENT MANAGEMENT | Clients | `/clients` | `sidebar.clients` |
| | Inbox | `/inbox` | `sidebar.inbox` |
| NUTRITION | Recipes | `/recipes` | `sidebar.recipes` |
| | Ingredients | `/ingredients` | `sidebar.ingredients` |

Note the **item order inside NUTRITION is Recipes then Ingredients** in the
design; `Sidebar.tsx:15` currently lists Ingredients first.

Two new section-header strings are needed in `cs`, `en`, `de`. The existing
`sidebar.clientsSection` (`CLIENTS` / `KLIENTI` / `KLIENTEN`) and
`sidebar.databaseSection` are leftovers from the pre-rebuild sidebar and do not
say "Client management" / "Nutrition" — add fresh keys rather than reusing
them.

All eleven icons are plain lucide names and `lucide-react` is already a
dependency, so nothing has to be downloaded. The four v1 items map to
`Users`, `MessageSquare`, `BookOpen` and `Columns` — note the design uses
`columns` for Ingredients, where `Sidebar.tsx:15` currently uses `Apple`.

---

## 5. Bottom block (`1:634`)

4px gap, three rows, in this order:

1. **Help & Support** — `help-circle` 16×16, label 13px Inter **Regular**
   `#64748b`, 8px padding, 10px gap. No background, no radius — it is visibly
   lighter than a nav item.
2. **Settings** — `settings` icon, same treatment.
3. **Profile row** (`1:645`) — separated by a **1px top border in `#1e1e22`**,
   12px top padding, 8px bottom padding, 8px inline padding, space-between:
   - Left column, 2px gap: the person's name at 12px Inter SemiBold `#f8fafc`,
     then their role at 10px Inter Regular `#94a3b8`.
   - Right: a `log-out` icon, **14×14** (smaller than the nav icons).

### Open points this raises

- **`sidebar.help` does not exist** in any of the three locale files. New key.
- **`sidebar.settings` does exist** (`Nastavení` / `Settings` /
  `Einstellungen`) and can be reused.
- **There is no role label anywhere.** The store's `User.roles` is a bare
  `string[]` (`web/src/stores/auth.ts:11`) with no i18n keys, and a dual-role
  professional carries two entries. The display has to be deterministic — pick
  one rule (e.g. a fixed precedence, or joining the mapped labels) and add a
  key per role to all three locales.
- **Logout must keep calling `useAuthStore.logout`**, which clears the query
  cache. Dropping that call reintroduces the cross-tenant cache leak fixed in
  #769.

---

## 6. Constraints the rewrite must not break

- **Exactly one `<nav>` landmark.** `web/tests/e2e/trainer/shell.smoke.spec.ts:27`
  uses an unscoped `page.getByRole('navigation')`; a second nav landmark fails
  Playwright's strict mode. The off-canvas drawer is fine because Radix
  unmounts its content when closed.
- **The four labels stay exact text nodes** — the same spec asserts
  `getByText('Clients', { exact: true })` and the other three. A section header
  reading `CLIENT MANAGEMENT` does not collide with them.
- **Logout stays reachable by the accessible name `Log out`** (spec line 35,
  page-scoped, so it may live in the sidebar).
- **The #1066 responsive behaviour survives**: `hidden lg:flex` static sidebar,
  `Sheet` drawer below `lg`, and the content column keeps `min-w-0 flex-1` plus
  `overflow-x-hidden` so no route scrolls sideways. With the top bar deleted,
  the drawer trigger moves into `AppShell`, `lg:hidden`, at the top-left of
  `<main>`'s padding box, keeping `aria-label={t('shell.openNavigation')}`
  (that key already exists in all three locales).
- **Deleting the search control means deleting `shell.searchPlaceholder`** from
  all three locale files.
- `Collapsible` for the section chevrons is available through the `radix-ui`
  umbrella package already installed — no new dependency.

---

## 7. Verification surface

- `npm run build` in `/web` (typecheck is part of it).
- Both trainer Playwright specs.
- All four v1 routes (`/clients`, `/inbox`, `/recipes`, `/ingredients`) at
  desktop and at 390px.
- At 390px, assert `document.documentElement.scrollWidth <= window.innerWidth`
  rather than judging the overflow by eye.
