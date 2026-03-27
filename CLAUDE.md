# Web Portal Redesign – Notion Design System

## Context

We are building the GoodFellas fitness platform (goodfellasgym.cz). The project is a monorepo with a `/backend`, `/web`, `/mobile` structure. The web portal uses React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS.

The goal is a complete redesign of the web portal (`/web`) based on the attached HTML prototype (`notion_portal.html`), which serves as the single visual source of truth.

---

## Design System – Exact Values

### CSS Variables (convert to Tailwind CSS variables or CSS custom properties in `globals.css`)

```css
/* Light mode */
--bg:        #ffffff;
--bg2:       #f7f7f5;   /* sidebar, secondary surfaces */
--bg3:       #efede9;   /* tertiary surfaces, tags */
--bg-hover:  #f1f0ee;   /* hover state */
--bg-active: #e9e8e3;   /* active / selected state */
--border:    rgba(55,53,47,0.09);   /* subtle borders */
--border-md: rgba(55,53,47,0.16);  /* medium borders */
--border-hv: rgba(55,53,47,0.25);  /* hover borders, focus rings */
--text:      #37352f;   /* primary text */
--text2:     #6b6860;   /* secondary text */
--text3:     #9b9a97;   /* placeholders, labels */
--text4:     #c7c6c3;   /* disabled, very subtle */
--accent:    #c9a84c;   /* gold accent (GoodFellas brand) */
--accent-bg: rgba(201,168,76,0.08);
--accent-br: rgba(201,168,76,0.3);
--red:       #c0392b;  --red-bg:    rgba(192,57,43,0.08);
--green:     #0f7b6c;  --green-bg:  rgba(15,123,108,0.08);
--blue:      #0b6e99;  --blue-bg:   rgba(11,110,153,0.08);
--purple:    #6940a5;  --purple-bg: rgba(105,64,165,0.08);
--orange:    #ad5700;  --orange-bg: rgba(173,87,0,0.08);
--radius:    4px;
--radius-md: 6px;
--radius-lg: 10px;
--sidebar-w: 240px;

/* Dark mode (class="dark" on <html>) */
--bg:        #191919;
--bg2:       #202020;
--bg3:       #2a2a2a;
--bg-hover:  #252525;
--bg-active: #2f2f2f;
--border:    rgba(255,255,255,0.07);
--border-md: rgba(255,255,255,0.13);
--border-hv: rgba(255,255,255,0.22);
--text:      #e6e3dd;
--text2:     #9b9a97;
--text3:     #6b6860;
--text4:     #454340;
/* semantic colors remain the same, just lighter shades */
```

### Typography

- Font: **Inter** (Google Fonts) – weights 300, 400, 500, 600
- Base `font-size: 14px`, `line-height: 1.5`
- `-webkit-font-smoothing: antialiased`
- Page titles: `font-size: 28px`, `font-weight: 700`, `letter-spacing: -0.02em`
- Section headings: `font-size: 22px`, `font-weight: 600`
- Body text: `font-size: 14px`, `font-weight: 400`
- Labels, metadata: `font-size: 12px` or `11px`, `color: var(--text3)`

---

## Components to Implement

### 1. Layout – AppShell

```
┌─────────────────────────────────────────────┐
│  TopNav (40px, fixed)                        │
├──────────┬──────────────────────────────────┤
│          │  Breadcrumb                      │
│ Sidebar  │  PageHeader (icon + h1 + sub)   │
│ (240px)  │  Toolbar (views + actions)       │
│          │  ─────────────────────────────  │
│          │  PageContent (padding 0 80px)   │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Sidebar:**
- `width: 240px`, `background: var(--bg2)`, `border-right: 1px solid var(--border)`
- Workspace logo at the top (24×24px, dark background, gold text)
- Sections with `font-size: 11px` uppercase labels
- Items: hover = `var(--bg-hover)`, active = `var(--bg-active)`
- On hover, action icons `···` appear (opacity: 0 → 1 transition)
- Indented sub-items (`padding-left: 28px`)
- User card at the bottom with `border-top`

**TopNav:**
- `height: 40px`, `position: fixed`, `background: var(--bg)`, `border-bottom: 1px solid var(--border)`
- Logo on the left (gold, `font-size: 12px`, `font-weight: 600`)
- Button groups with separators between sections
- Active tab: `background: var(--bg-active)`, `font-weight: 500`

### 2. Database Table (Notion DB style)

```tsx
// Behaviour:
// - Row hover: background var(--bg-hover), .row-actions becomes visible
// - Column header hover: background var(--bg-hover)
// - Click on row title: underline, navigate to detail
// - "+ Add record" row at the bottom

interface DatabaseTableProps {
  columns: Column[]
  rows: Row[]
  onAddRow: () => void
  onRowClick: (id: string) => void
}
```

CSS pattern:
```css
.db-table th { font-size: 12px; font-weight: 500; color: var(--text3); padding: 6px 12px; }
.db-table td { padding: 7px 12px; font-size: 13px; border-bottom: 1px solid var(--border); }
.db-table tr:hover td { background: var(--bg-hover); }
.db-table tr:hover .row-actions { opacity: 1; }
.row-actions { opacity: 0; transition: opacity 0.1s; }
```

### 3. View Switching (Table / List / Cards)

A toolbar above the database with a view switcher. The active view has `background: var(--bg-active)`.

```tsx
type ViewType = 'table' | 'list' | 'cards'

// Table  = standard DB table
// List   = list items with avatar, name, and metadata on the right
// Cards  = CSS grid, minmax(240px, 1fr), each card has a cover + body
```

### 4. Dialogs (Modal System)

```css
/* Overlay */
.overlay { background: rgba(0,0,0,0.45); position: fixed; inset: 0; z-index: 1000; }

/* Dialog */
.dialog {
  background: var(--bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-md);
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
}
```

Closing: click on overlay, Escape key, or X button.

Required dialogs:
- **NewClient** – name, email, gender, age, height/weight, goal, toggle "Send invitation email"
- **EditClient** – edit all profile fields
- **AddFoodToPlan** – search with tabs (Foods / Recipes / Recent), macro preview, quantity input
- **NewFood** – form with macro validation (P×4 + C×4 + F×9 ≈ kcal)
- **AddMeal** – name, time, optional recipe selection
- **AddExercise** – search with muscle group filters, sets/reps/weight inputs
- **ShoppingList** – week range selector, checkboxes to tick off items, export button

### 5. Form Elements

```css
.form-input {
  width: 100%; padding: 7px 10px;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-md);
  font-size: 13px; font-family: inherit;
  background: var(--bg);
  transition: border-color 0.15s;
}
.form-input:focus { outline: none; border-color: var(--border-hv); }
.form-input::placeholder { color: var(--text3); }
```

Toggle switch: `width: 36px`, `height: 20px`, `border-radius: 10px`. ON state = `background: var(--green)`.

### 6. Tags / Badges

```css
.tag {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 12px;
  font-size: 12px; font-weight: 500;
}
/* Variants: green, blue, orange, purple, red, gray, accent */
```

### 7. Inline Editable Values

Clickable values in the client page property list:

```css
.editable-val {
  display: inline-block; padding: 1px 4px;
  border-radius: var(--radius);
  cursor: text; transition: background 0.1s;
}
.editable-val:hover { background: var(--bg-hover); }
.editable-val:focus { background: var(--bg-active); outline: 1px solid var(--border-md); }
```

### 8. Property List (Client Page)

```
Age                  27
Height / weight      168 cm · 63.1 kg  ↓ 2.4 kg
Email                petra@example.cz
Active plans         [🥗 Meal plan]  [🏋️ Strength A/B]   ← mention chips
```

Hovering the full row = `var(--bg-hover)`. Key column has `width: 170px` and is gray.

### 9. Nutrition Plan Editor

Two-column layout: `1fr 256px`. Left column = meals, right column = macros sidebar.

**Meal block:**
- Collapsible section with a `▶` chevron
- Inline editing of food amounts (contenteditable or borderless input)
- Live dropdown food search while typing (no modal required)
- Hover on a food row reveals `✕` delete button

**Macros sidebar:**
- Large calorie number at the top
- Colour-coded progress bars (Protein = blue, Carbs = orange, Fat = purple)
- Stack bar (proportional macro visualisation)
- Live recalculation on every change

### 10. Week / Day Tabs (Nutrition Editor)

Two rows of tabs:
- Top row: Week 1–12, badge showing average calories or "template"
- Bottom row: Mon–Sun, badge showing day calories or "—"

Active tab: `border-bottom: 2px solid var(--text)`, `font-weight: 500`.

---

## Pages to Implement

### `/dashboard`
- Stats row (4 blocks): Active clients, Avg. compliance, Workouts/plan, Alerts
- Callout components for warnings (orange left border)
- Client database with Table / List / Cards view switcher
- New client dialog

### `/clients/:id`
- Breadcrumb navigation
- Page header with emoji icon, goal tag, streak and compliance badges
- Property list (inline editable values)
- Stats row (3 blocks): Compliance, Streak, Weight progress
- Simple bar chart for weight progress
- Recent activity timeline

### `/clients/:id/nutrition`
- Fullscreen editor without page header (use full viewport height)
- Topbar with breadcrumb and action buttons
- Two rows of tabs (weeks + days)
- Two-column layout (meals + macros sidebar)
- Live inline food search (no modal)
- Dialogs for adding meals and recipes

### `/clients/:id/training`
- 7-column week grid (Mon–Sun)
- Session cards in each day column, clickable → session detail dialog
- Expandable exercise blocks with inline set editing
- Dialogs for adding exercises and sessions

### `/clients/:id/goals`
- Two-column layout (anamnesis + macros)
- Editable property values
- BMR/TDEE calculation with explanation
- Macro stack bar

### `/foods`
- Table / Cards view switcher
- Category filter chips
- Inline search
- New food dialog with macro validation

### `/messages`
- Chat interface with conversation list in sidebar
- Messages with avatars and timestamps
- Message input with send button

---

## Key UX Rules (Notion Patterns)

1. **Hover-first UI** – action buttons (delete, edit) only appear on row hover, not always visible
2. **Inline editing** – clicking a value edits it directly, no modal where avoidable
3. **Subtle transitions** – `transition: background 0.1s` everywhere, no dramatic animations
4. **Minimal visual noise** – borders are very subtle (`rgba(55,53,47,0.09)`), not thick lines
5. **Consistent spacing** – page content has `padding: 0 80px`, sidebar items `padding: 5px 12px`
6. **Dark mode** – CSS variables switch via `class="dark"` on `<html>`, no hardcoded colours anywhere
7. **Live recalculation** – macros recalculate instantly on every gram change, no UI debounce
8. **Auto-save** – changes save automatically after 1–2 seconds, with a "Saved / Saving…" indicator

---

## What to Keep from Existing Code

- Keep existing **TanStack Query** hooks and API calls
- Keep **Zustand** store structure (auth, active client…)
- **Replace** all shadcn/ui components with custom ones following this design system, OR adapt shadcn theming (custom recommended for pixel accuracy)
- Use Tailwind only for spacing/flex/grid utilities; handle colours via CSS variables
- Keep **React Hook Form + Zod** for dialog forms

---

## Reference File

The attached file `notion_portal.html` is a complete interactive prototype with all screens, dialogs, and interactions. Use it as a pixel-perfect reference for every component. Open it in a browser and navigate through each screen as a visual specification.

If you are unsure how a specific component should look, always defer to this HTML file.

---

## Implementation Order

1. `globals.css` – CSS variables, reset, base typography
2. Layout components – `AppShell`, `Sidebar`, `TopNav`, `PageHeader`, `Toolbar`
3. Primitives – `Button`, `Tag`, `Input`, `Select`, `Toggle`, `Dialog`, `Toast`
4. Data components – `DatabaseTable`, `ListView`, `CardGrid`, `PropertyList`
5. Domain components – `MacroSidebar`, `MealBlock`, `FoodRow`, `ExerciseBlock`
6. Pages – Dashboard → Client detail → Nutrition plan → Training plan → Goals → Foods → Messages
7. Dark mode – verify all pages in both light and dark modes
8. Dialogs – wire all dialogs to real API calls

---

## Notes

- The UI text language is **Czech** – all labels, placeholders, and copy must remain in Czech
- Brand colour is gold `#c9a84c` (GoodFellas Gym) – use for logo, accents, and primary CTAs
- The goal is for the web portal to feel like Notion – clean, minimal, and professional
- The mobile app (React Native) is out of scope for this prompt – web portal only
