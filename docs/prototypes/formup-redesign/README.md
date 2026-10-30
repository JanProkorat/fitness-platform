# Form Up redesign — design source of truth

Repo snapshot of the **Form Up redesign canvas**, the design source of truth for
the web portal and the mobile apps:
<https://claude.ai/artifact/HFzM8WqykBxJvkLdiqU85h> (private claude.ai Design
artifact — only the main Claude session can open it; agents read this snapshot).

**Snapshot of canvas version 1793274985-492c, exported 2026-10-29 (#1810); `canvas.json` and the GlassOffline* boards from 1793279172-ac8c (#1830); `canvas.json` and the PageClientActivityOfflineSync / PageNotificationsOfflineSync boards from 1793281475-31a2 (#1819); `canvas.json` and the PageClientPlanEditorOfflineSync / PageClientPlanDayOfflineSync boards from 1793295740-493c (#1840), leaving out the 10 GlassQuestionnaire* boards on the canvas; the GlassOfflineSynced boards and the new GlassOfflineSyncedSheet boards from 1793351906-f400 (#1862), keeping this snapshot's own layout (the live canvas has since been reorganised; re-sync separately); the GlassOfflineNotSaved boards from 1793352833-8ee4 (#1865), same approach.** If the canvas has moved
on, re-export before relying on this copy (see Rebuilding).

| Path | Contents |
|---|---|
| `index.html` | Gallery of every board, grouped by canvas page and row |
| `interactive/` | Clickable web-portal prototype, light and dark (open `interactive/index.html`) |
| `interactive-client/`, `interactive-coach/` | Clickable client-app and coach-app prototypes, light and dark, shown in a phone frame |
| `web/` | Web portal: entry page, registration, clients (incl. Payment and Automations tabs), inbox, recipes, ingredients, plan templates, forms, automations, packages and discounts, coach profile, settings (incl. payments, plan and billing) and account menu, password reset, coach plans (plan picker, sign-up plan step, paywalls, plan ended), Form Up admin (plans, promotions, coaches) — light and dark |
| `mobile-light/`, `mobile-dark/` | Client mobile app (Liquid Glass) |
| `coach-light/`, `coach-dark/` | Coach mobile app |
| `email/` | Account, notification and payment emails — light (`C`) and dark (`D`) |
| `concepts/`, `logo/` | Colour concept frames and logo explorations |
| `screens.json` | Board list with sizes, used by the screenshot script |
| `source/` | Generators (`gen*.py`), board files (`project/*.dc.html`) and canvas layout (`project/canvas.json`) |

Board files are named after the canvas boards. In `source/project/`, web boards
end in `C` (light) or `D` (dark), e.g. `PageTemplateDayC.dc.html`; mobile boards
end in `Light` / `Dark`. Exported file names add a row-column prefix: web
files keep the theme letter (`web/13-07-page-template-day-c.html`), client-app
files drop the `Glass` prefix, and mobile files drop the theme suffix, which the
folder carries instead (`mobile-dark/02-01-today.html`,
`coach-dark/02-01-coach-today.html`). To find a board reliably by
name, open `source/project/<Board>.dc.html`.

Sample names, numbers and copy are placeholders, not product decisions.

## Clickable prototypes

`interactive/` holds one page per web board and theme. The sidebar, tabs,
switches, drawers, dialogs and the library panel link to the matching board.
`interactive-client/` (starts at Login) and `interactive-coach/` (starts at
coach setup; sign-up is shared with clients) do the same for the mobile apps: the tab bar, back buttons, list
rows and primary buttons link through, and the phone is centred and scaled to
the window.
The floating bar at the bottom right switches light/dark, jumps to any screen
and toggles **Hotspots** (or press `H`) to show what is clickable. Interactions
are approximations: a click jumps to the board that shows the result.

## Rebuilding

```bash
cd source
python3 export_static.py ..          # boards → standalone HTML + index.html + screens.json
python3 export_interactive.py ..     # boards → clickable prototypes in ../interactive*/
node screenshot.mjs ..               # PNG per screen (uses web/node_modules/playwright and Brave)
```

Before exporting, copy the current `canvas.json` and every board file from the
canvas into `source/project/`. On the canvas, each mobile app is one page with
light boards above dark ones; the exports split them into `*-light/` and
`*-dark/` by the `Light`/`Dark` file suffix. Screenshots use reduced motion, so
animated boards (launch screen, logo marks) show their finished frame. The `gen*.py` scripts regenerate the board files;
`gen.py` and `gen2.py` also rewrite `project/canvas.json` — restore it afterwards.
