# Form Up redesign — design source of truth

Repo snapshot of the **Form Up redesign canvas**, the design source of truth for
the web portal and the mobile apps:
<https://claude.ai/artifact/HFzM8WqykBxJvkLdiqU85h> (private claude.ai Design
artifact — only the main Claude session can open it; agents read this snapshot).

**Snapshot of canvas version 147, exported 2026-10-06.** If the canvas has moved
on, re-export before relying on this copy (see Rebuilding).

| Path | Contents |
|---|---|
| `index.html` | Gallery of every board, grouped by canvas page and row |
| `interactive/` | Clickable web-portal prototype, light and dark (open `interactive/index.html`) |
| `interactive-client/`, `interactive-coach/` | Clickable client-app and coach-app prototypes, light and dark, shown in a phone frame |
| `web/` | Web portal: entry page, registration, clients, inbox, recipes, ingredients, plan templates, forms — light and dark |
| `mobile-light/`, `mobile-dark/` | Client mobile app (Liquid Glass) |
| `coach-light/`, `coach-dark/` | Coach mobile app |
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
account type) do the same for the mobile apps: the tab bar, back buttons, list
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
canvas into `source/project/`. The `gen*.py` scripts regenerate the board files;
`gen.py` and `gen2.py` also rewrite `project/canvas.json` — restore it afterwards.
