# Form Up redesign — design source of truth

Repo snapshot of the **Form Up redesign canvas**, the design source of truth for
the web portal and the mobile apps:
<https://claude.ai/artifact/HFzM8WqykBxJvkLdiqU85h> (private claude.ai Design
artifact — only the main Claude session can open it; agents read this snapshot).

**Snapshot of canvas version 129, exported 2026-10-05.** If the canvas has moved
on, re-export before relying on this copy (see Rebuilding).

| Path | Contents |
|---|---|
| `index.html` | Gallery of every board, grouped by canvas page and row |
| `interactive/` | Clickable web-portal prototype, light and dark (open `interactive/index.html`) |
| `web/` | Web portal: entry page, registration, clients, inbox, recipes, ingredients, plan templates, forms — light and dark |
| `mobile-light/`, `mobile-dark/` | Client mobile app (Liquid Glass) |
| `coach-light/`, `coach-dark/` | Coach mobile app |
| `concepts/`, `logo/` | Colour concept frames and logo explorations |
| `screens.json` | Board list with sizes, used by the screenshot script |
| `source/` | Generators (`gen*.py`), board files (`project/*.dc.html`) and canvas layout (`project/canvas.json`) |

Board files are named after the canvas boards. In `source/project/`, web boards
end in `C` (light) or `D` (dark), e.g. `PageTemplateDayC.dc.html`; mobile boards
end in `Light` / `Dark`. The exported file names add a row-column prefix and
keep the theme letter, e.g. `web/13-07-page-template-day-c.html` (light) and
`web/14-07-page-template-day-d.html` (dark).

Sample names, numbers and copy are placeholders, not product decisions.

## Clickable prototype

`interactive/` holds one page per web board and theme. The sidebar, tabs,
switches, drawers, dialogs and the library panel link to the matching board.
The floating bar at the bottom right switches light/dark, jumps to any screen
and toggles **Hotspots** (or press `H`) to show what is clickable. Interactions
are approximations: a click jumps to the board that shows the result.

## Rebuilding

```bash
cd source
python3 export_static.py ..          # boards → standalone HTML + index.html + screens.json
python3 export_interactive.py ..     # boards → clickable prototype in ../interactive/
node screenshot.mjs ..               # PNG per screen (uses web/node_modules/playwright and Brave)
```

Before exporting, copy the current `canvas.json` and every board file from the
canvas into `source/project/`. The `gen*.py` scripts regenerate the board files;
`gen.py` and `gen2.py` also rewrite `project/canvas.json` — restore it afterwards.
