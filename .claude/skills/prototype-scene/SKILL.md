---
name: prototype-scene
description: Add a scene to an existing HTML prototype (mobile/trainer/notion) or scaffold a new one. Encodes per-file wiring (nav, scene container, visibility, tokens). Invoke for "add scene", "prototype a view".
argument-hint: "<prototype-file> <scene-id> <scene-title>"
---

# prototype-scene — HTML prototype scaffolding

The project keeps three HTML prototypes under `docs/` that act as the visual
source-of-truth for product decisions before any code is written:

| Output (committed, opens in browser) | Source directory | Scene model |
|------|---------|-------------|
| `docs/mobile_prototype.html` | `docs/prototypes/mobile/` | `.phone` + `showPhone(id)` |
| `docs/trainer_prototype.html` | `docs/prototypes/trainer/` | `.phone` + `showPhone(id)` |
| `docs/notion_portal.html` | `docs/prototypes/notion/` | `.screen` + `showScreen(id)` |

Each source directory has this layout:

```
docs/prototypes/<name>/
  index.html          ← template shell with <!-- include: ... --> markers
  styles/*.css        ← tokens / layout / components split
  scripts/*.js        ← nav / state / feature modules
  scenes/<scene>.html ← one file per scene (ph-*.html for mobile/trainer, s-*.html for notion)
```

**Never edit `docs/<name>.html` directly** — it starts with a `<!-- GENERATED … -->`
banner and is overwritten on every build. Edit files under `docs/prototypes/<name>/`
and run:

```bash
node docs/prototypes/build.mjs
```

This concatenates the template + includes back into `docs/<name>.html`. The output
is self-contained (no runtime dependencies beyond the Inter web font) — keep it
that way. No bundler, no framework.

---

## Before starting

1. Confirm which prototype the user is targeting. If ambiguous, ask:
   - client-facing mobile screen → `mobile_prototype.html`
   - trainer-facing mobile screen → `trainer_prototype.html`
   - trainer-facing web/portal screen → `notion_portal.html`
   - none of the above → new prototype file (see *Creating a new prototype* below)
2. List the target prototype's `docs/prototypes/<name>/scenes/` directory once.
   Never duplicate an existing scene id. Scene ids are lowercase-kebab, prefixed:
   - mobile / trainer → `ph-<name>` (e.g. `ph-plan-history`)
   - notion portal → `s-<name>` (e.g. `s-dashboard`)

   Scene file names match the id without the prefix: `ph-plan-history` lives in
   `scenes/plan-history.html`; `s-dashboard` lives in `scenes/dashboard.html`.
3. Pick the nearest existing scene file that resembles what's being added and
   copy its skeleton — don't invent new block types from scratch.

---

## Adding a scene to a mobile prototype (`mobile_prototype.html` / `trainer_prototype.html`)

These prototypes render multiple iPhones on a `#stage`. Exactly one `.phone`
is visible at a time; `showPhone(id)` toggles `display:block` on the target
and hides the rest.

### 1. Add the scene file

Create a new file under `docs/prototypes/<name>/scenes/<new-scene>.html`. The
file holds exactly the scene block — the `.phone-wrap` through its closing
`</div>` — with no surrounding `<html>`/`<body>` or other chrome. Skeleton:

```html
<div class="phone-wrap">
  <div class="phone-label">ČESKÝ TITULEK</div>
  <div class="phone" id="ph-new-scene" style="display:none">
    <div class="di"></div>                 <!-- dynamic island -->
    <div class="status-bar">
      <div class="sb-time">9:41</div>
      <div class="sb-icons">
        <!-- copy signal/wifi/battery SVGs verbatim from any existing phone -->
      </div>
    </div>

    <div class="scroll-area">
      <!-- page content: use .ios-page-header / .ios-section-hdr /
           .ios-card etc. — never invent new base classes -->
    </div>

    <div class="tab-bar">
      <!-- 5 .tab blocks — copy from an existing scene of the same tab set -->
    </div>
  </div>
</div>
```

Rules:
- The first scene referenced from `index.html` (currently `ph-today` in mobile,
  `ph-dnes` in trainer) keeps `class="phone"` with no inline display. All other
  scenes MUST carry `style="display:none"` so the initial load only shows one phone.
- Use design tokens only: `var(--ios-gold)`, `var(--ios-label)`,
  `var(--ios-bg)`, `var(--ios-sep)`, etc. The gold accent is `#c9a84c`;
  never inline that hex — go through `--ios-gold`.
- Status bar, dynamic island, tab bar are fixed chrome; copy them verbatim.
- Label text is Czech (primary locale of the prototype).

### 2. Register the scene in `index.html`

Open `docs/prototypes/<name>/index.html` and add an include marker in
**document order** next to related scenes:

```html
<!-- include: scenes/new-scene.html -->
```

Scenes render in the order listed here, so pick a spot next to the scene whose
`.pnav-group` your new button will live in.

### 3. Wire the nav button

Inside `#pnav` (still in `index.html`), find the `.pnav-group` whose category
matches the scene's theme (Hlavní / Plány & Dotazníky / Spolupráce / Zprávy / …).
Add one `.pb` button to that group's `.pnav-items` list:

```html
<button class="pb" onclick="showPhone('ph-new-scene')">Český label</button>
```

If no group fits, add a new `.pnav-group`:

```html
<div class="pnav-group">
  <button class="pnav-cat" onclick="toggleNavGroup(this)">🎯 Kategorie ▾</button>
  <div class="pnav-items">
    <button class="pb" onclick="showPhone('ph-new-scene')">Nová obrazovka</button>
  </div>
</div>
```

### 4. Register the label in `showPhone`

Open `docs/prototypes/<name>/scripts/nav.js`. `showPhone(id)` contains a `map`
object that keys scene id → nav button label. The nav uses this to set the
`.pb.active` highlight. Add the new entry to that map; without it the nav
won't highlight when the scene is shown:

```js
var map = {
  'ph-today':'Dnes',
  // …
  'ph-new-scene':'Nová obrazovka',
};
```

### 5. Rebuild the artifact

```bash
node docs/prototypes/build.mjs
```

This regenerates `docs/mobile_prototype.html` / `docs/trainer_prototype.html`.
Commit the source files *and* the regenerated artifact together.

### 6. Don't break

- Do not edit `docs/<name>.html` directly — changes will be lost on next build.
- Do not rename `showPhone`, `toggleNavGroup`, `.phone`, `.pb`, `.pnav-*`.
- Do not add external `<script src>` / `<link href>` beyond Inter.
- Do not put multiple `.phone` ids equal to the same string.
- Do not use `localStorage`/`sessionStorage` — prototypes must reload cleanly.

---

## Adding a scene to the Notion portal prototype (`notion_portal.html`)

The portal uses a top `#tnav` and a `#canvas` containing multiple `.screen`
divs. `showScreen(id)` toggles `.active` on the matching screen and the
matching `.tn-btn` button.

### 1. Add the screen file

Create `docs/prototypes/notion/scenes/<new-screen>.html` (file name is the id
without the `s-` prefix). The file holds exactly the screen block:

```html
<div id="s-new-screen" class="screen">
  <!-- typical layout: AppShell with .sb + .main -->
  <div class="shell">
    <div class="sb" id="sb-new-screen"><!-- sidebar items --></div>
    <div class="main">
      <div class="bc"><a onclick="showScreen('s-dashboard')">Dashboard</a>
        <span class="bc-sep">/</span><span>Nová stránka</span></div>
      <!-- page content using .card, .btn, .toolbar, .callout … -->
    </div>
  </div>
</div>
```

Only the first screen referenced from `index.html` (currently `s-dashboard`)
uses `class="screen active"`. All others are just `class="screen"` (visibility
is driven by the `.active` modifier, not an inline style — intentional, and
different from the mobile prototypes).

### 2. Register the screen in `index.html`

Add an include marker inside `#canvas` in document order:

```html
<!-- include: scenes/new-screen.html -->
```

### 3. Wire the top-nav button

Still in `index.html`, add a `.tn-btn` to the matching section in `#tnav`:

```html
<button class="tn-btn" onclick="showScreen('s-new-screen')">Nová stránka</button>
```

### 4. If the screen has its own sidebar contents

In `docs/prototypes/notion/scripts/nav.js`, `showScreen` calls
`buildSidebar(sbMap[id], id)`. To populate a sidebar, either:
- reuse one of the existing sidebar maps (`sb-dashboard`, `sb-client`,
  `sb-training`, `sb-messages`, `sb-nutrition`, `sb-foods`, `sb-goals`), or
- add an entry to `sbMap` in `showScreen` and a matching `buildSidebar`
  case. Prefer reuse unless the screen truly needs a new navigation tree.

### 5. Design tokens

Use CSS custom properties from `:root` and `body.dark` (e.g. `var(--t)`,
`var(--bg2)`, `var(--acc)`). The accent `--acc` is `#c9a84c`. Never inline
colors. Tokens live in `styles/tokens.css`; add new ones there rather than
inline.

### 6. Rebuild the artifact

```bash
node docs/prototypes/build.mjs
```

This regenerates `docs/notion_portal.html`. Commit source + regenerated
artifact together.

---

## Creating a new prototype file from scratch

Ask first whether it should follow the mobile pattern (iOS shells) or the
portal pattern (responsive app shell). Then copy the closest existing source
directory as a starting point and strip its scenes down to one skeleton scene
— do not hand-type the structure, you will miss a token or SVG.

```bash
cp -R docs/prototypes/mobile docs/prototypes/<new-name>
# or
cp -R docs/prototypes/notion docs/prototypes/<new-name>
```

Then:
1. Update `<title>` in `index.html`.
2. Delete all but one `scenes/*.html` file; remove the extra
   `<!-- include: scenes/... -->` markers from `index.html`.
3. Keep `#pnav` / `#tnav` skeleton in `index.html`, the CSS files
   (`tokens.css`, `layout.css`, `components.css`), and the JS files
   (`showPhone`/`showScreen`, `toggleNavGroup`, any `buildSidebar` helpers).
4. Clear the `map` / `sbMap` objects in `scripts/nav.js` down to the single
   remaining scene.
5. Add an entry to the `prototypes` array in `docs/prototypes/build.mjs`
   mapping `<new-name>` to its output filename:

   ```js
   const prototypes = [
     { src: 'mobile',    out: 'mobile_prototype.html' },
     { src: 'trainer',   out: 'trainer_prototype.html' },
     { src: 'notion',    out: 'notion_portal.html' },
     { src: '<new-name>', out: '<new-file>.html' },
   ];
   ```

6. Run `node docs/prototypes/build.mjs` to produce `docs/<new-file>.html`.
7. Add a progress note to `docs/PROGRESS.md` pointing at the new file so
   future sessions know it exists.

---

## Related skills to chain after scaffolding

- **`design:design-critique`** — once the scene HTML is drafted, run a
  critique pass over hierarchy/consistency before handing back.
- **`design:accessibility-review`** — color contrast, touch targets, and
  keyboard nav on new scenes. Cheap to run, catches regressions against
  iOS/Notion tokens.
- **`design:ux-copy`** — for Czech button/label/empty-state text on the new
  scene. Keep copy aligned with existing scenes.
- **`design:design-system`** — if the scene tempts you to introduce a new
  component class (`.ios-*`, `.sb-*`, etc.), run the design-system skill
  first to decide whether to extend an existing token or add a new one
  *in `:root`* rather than inlining.
- **`greencode-brand`** — only when the scene contains marketing-style
  copy, external-facing visuals, or will be screenshotted for decks.
- **Browser MCPs** (if connected) — open the prototype file
  (`file:///…/docs/<file>.html`) and take a screenshot to confirm the
  scene renders and the nav button toggles. Especially useful before
  handing a new prototype file back to the user.

---

## Checklist before handing back

- [ ] Scene file placed at `docs/prototypes/<name>/scenes/<id-without-prefix>.html`
- [ ] Scene id is unique and matches the prefix (`ph-*` or `s-*`)
- [ ] `display:none` inline style on every non-first mobile scene
- [ ] `<!-- include: scenes/<file>.html -->` marker added to `index.html`
- [ ] Nav button added to the right group / section in `index.html`
- [ ] `showPhone`'s label map (or portal's `sbMap`) updated in `scripts/nav.js`
- [ ] No inline hex colors — tokens only
- [ ] No external JS/CSS added
- [ ] Ran `node docs/prototypes/build.mjs` and committed the regenerated artifact
- [ ] Regenerated `docs/<name>.html` opens in a browser without console errors
- [ ] Invoked `progress-update` skill to note the added scene
