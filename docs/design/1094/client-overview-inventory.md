# Client detail — Overview tab — design inventory, issue #1094

One render beside this file:

- `client-overview-target.png` — **the contract.** The wireframe's
  `client-overview` frame, full page at roughly 2000px wide.

## Provenance, and what it limits

**This is a user-supplied screenshot taken on 2026-09-21, not a pulled Figma
node.** The Figma connector is at its plan's monthly limit. Structure, order,
copy and layout are reliable; pixel sizes are approximate and every number
below is read off the image. Where the repo already has a token or component
that serves the same purpose, prefer it over a number estimated here.

The shell around the page (dark sidebar, section groups, footer) is **already
built** (#1073) and is not part of this issue — the wireframe shows the full
seven-section sidebar; ours shows only the two v1 sections, by design.

## Three decisions the user made before this was filed

1. **Only the Overview tab is built.** All seven tabs render; six are
   disabled with the repo's coming-soon treatment.
2. **No backend → the card still renders, with `TBD` in place of the value.**
3. **The Messages trend gets a real endpoint** (weekly coach/client counts).

Two derivations the user approved: the status pill is computed the way the
clients list computes it; the daily check-in trend is TBD rather than
redesigned as weekly.

## Structure, top to bottom

### Header

- Left: a **back arrow**, then the client's **full name** as the page title
  (`text-title`, ~28px bold), then a small uppercase **status pill** —
  `ACTIVE` in the mock, muted fill, small caps.
- Beneath, a **meta line** in muted text, dot-separated:
  `25 years old • Male • 180 cm •` then a bordered **goal chip** `Weight
  Loss`. Omit any segment whose value is absent (sex is only known after
  onboarding).
- Right, aligned with the title: four **outlined buttons** — `Chat`, `Tasks`,
  `Notes`, `Info`. Per the issue: Chat and Notes are live links; Tasks is
  disabled with `TBD`; Info is disabled with coming-soon.

### Tab bar

Seven text tabs with an underline on the active one, a hairline beneath the
whole row: **Overview** (active) · Development · Nutrition · Workouts ·
Storage · Payment · Automations. Same underline-tab treatment the clients
page already uses (`ClientsPage` tabs) — reuse it, do not invent a second.

### Row 1 — four stat cards, equal width

Each card: uppercase muted label (~11px, letter-spaced), a large value
(~26–28px bold), a muted caption beneath (~11–12px).

| Card | Label | Value | Caption | Source |
|---|---|---|---|---|
| 1 | AVERAGE RATING | `2.8 / 5` | Based on check-in answers | **TBD** — no rating exists |
| 2 | PAYMENTS | `N/A` | No payments found for client | **TBD** — no payments domain |
| 3 | CURRENT WEIGHT | `72 kg` | `-3 kg this week • 70kg goal` | latest measurement; delta derived; goal from onboarding/plan |
| 4 | CLIENT SINCE | `7 days` | `Started 26. Jan, 2026` | derived from `LinkedAt` |

**Card 1 in the mock has a pale red fill and red text** — the rating is below
some threshold. With the value TBD there is no threshold to evaluate; render
it in the neutral card style like the other three. Do not add a red token for
a state that cannot occur.

### Row 2 — two plan cards, ~60/40 split

- **Current meal plan** — heading, then an icon tile (rounded square, muted
  fill, a cup/plate glyph) beside the plan **name** in bold and a muted
  detail line `2500 kcal • 40% Carb / 30% Protein / 30% Fat`. Use the lucide
  `Utensils` icon already used for nutrition elsewhere. Percentages are
  **derived from grams** (×4/×4/×9 over daily kcal) — say so in a comment.
- **Latest workout** — heading, icon tile with the `Dumbbell`, plan **name**
  bold, detail line `6 Exercises • Estimated 45 min`. Exercise count is
  derived from the plan detail; **estimated minutes is TBD**, so the line
  reads `6 exercises • TBD`.

Both cards show an empty state when the client has no active plan of that
type; the old locale keys `clientDetail.prehled.noActivePlan.*` carry that
copy already.

### Row 3 — two trend widgets, ~60/40 split

- **Check-in trend** — heading with `Last 15 days` right-aligned in muted
  text; a **3 × 5 grid** of square cells, each carrying one small icon: a
  check (completed), a clock (missed / upcoming). Legend beneath: three dots
  — Completed · Missed · Upcoming. **The whole widget is TBD**: render the
  heading, the legend, and the grid frame in a TBD state. Check-ins are
  weekly in this product; no daily grain exists.
- **Messages trend** — heading with `Last 4 weeks` right-aligned; a small
  **grouped bar chart**, four groups labelled `W1`–`W4`, two bars per group
  (darker = Coach Messages, lighter = Client Messages), legend beneath with
  two squares. Fed by the **new endpoint** — four rows, oldest first, zeros
  for empty weeks so four groups always render.

## Colours and type — all existing tokens

Nothing here needs a new token. Cards are `bg-card` / `border-border` with
the `--gf-radius-lg` corner. Labels are `text-caption` uppercase with
`tracking-label`. Large values are `text-title`-sized bold. Muted text is
`text-muted-foreground`. The two chart bar shades: `--gf-muted` for coach and
`--gf-line` for client read closest to the mock; confirm at design review
rather than adding a chart palette.

## Data — one new endpoint, everything else exists

Primary reads: `GET /trainer/clients/{clientId}` (dashboard),
`GET /trainer/clients/{clientId}/plans`, `GET
/trainer/clients/{ClientId}/measurements`, plus a plan-detail fetch per
active plan for macros / exercise count.

New: `GET /trainer/clients/{ClientId}/message-stats?weeks=4` →
`[{ weekStart, coachMessages, clientMessages }]`. Spec in the issue body.

## Copy

The deleted old detail page left a large `clientDetail.*` block in all three
locales (tabs, verdict, plan cards, progress, measurements dialog). Reuse
what fits — the eight old tab names do **not** match the wireframe's seven,
so the tab keys are new. Remove old keys only when this issue's component
would otherwise be their sole consumer and they are wrong; do not sweep the
block.

See [[docs/design/1073/shell-inventory.md]] for the shell this page sits in,
and [[docs/design/1091/plans-popup-inventory.md]] for the same
screenshot-based practice.
