# Form Up redesign — design prototype

Static copy of the "Form Up colour directions" design canvas: the energetic ink-and-red direction (C) for the coach portal, its dark mode, and the full client mobile app in light and dark Liquid Glass style.

Open `index.html` in a browser for a gallery of every screen. Each screen is also a standalone HTML file you can open on its own, or import into Figma with an HTML-to-Figma plugin.

| Folder | Contents |
|---|---|
| `concepts/` | Palette and first concept frames for direction C |
| `web/` | Current coach-portal pages redesigned, light and dark |
| `mobile-light/`, `mobile-dark/` | Client app, one row prefix per area (`01-` start, `02-` today & training, …) |
| `source/` | Generator scripts, canvas frames (`project/*.dc.html`) and layout (`project/canvas.json`) |

Sample names, numbers and copy are placeholders, not product decisions.

## Rebuilding

```bash
cd source
python3 export_static.py ..          # canvas frames → standalone HTML + index.html + screens.json
node screenshot.mjs ..               # PNG per screen (uses web/node_modules/playwright and Brave)
```

The `gen*.py` scripts regenerate the frames in `project/`. `gen.py` and `gen2.py` also rewrite `project/canvas.json` — restore it from git afterwards.
