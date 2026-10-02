# Recipes page — design inventory

Source: Figma `Qi8EpYD2b0e717hvi2bbVq`, page "⚡Wireframe", frame **`recipes-state-02`** (node `1:14933`, 1920×1080), read via `get_design_context` on 2026-09-28.
**`recipes-state-01`** (node `1:14795`) was not read through Figma (Starter limit reached); its PNG export shows the same **empty** page **without** the drawer. The only differences from `recipes-state-02`: its empty-state button reads "New Recipe" (state-02 reads "Create Recipe"). Renders: `recipes-state-01.png` (empty), `recipes-state-02.png` (empty + New Recipe drawer).

**The wireframe has no populated recipe list and no ingredients step for a recipe** — neither frame shows them.

**Not this page:** `Add-Recipe-Drawer` (node `1:3542`, inside `client-nutrition-07- add meal`) is the nutrition-plan editor's "add a recipe to a meal" picker (search, filter chips, recipe cards with image/macros/diet badge, "+" per card, "Drag" handle). It belongs to the plan editor, which is after the epic's hard stop. Recorded here only so nobody mistakes it for the recipe create drawer.

The app shell is already built; here **Nutrition → Recipes** is the active nav item (bg `#1e1e22`, label white).

## Page (padding 32, vertical gap 24)

1. **Title** "Recipes" — Inter Bold **24** `#0f172a` *(Ingredients uses 28 — wireframe inconsistency; match the page-title token already used by other pages)*.
2. **Search row** (space-between):
   - Search — white, 1px `#e2e8f0`, radius 8, padding 10×16, **width 320**, gap 8; search icon 16; placeholder "Search recipes..." Inter Regular 13 `#94a3b8`.
   - CTA "New Recipe" — bg `#1a5c41`, radius 8, padding 10×16, gap 8, plus icon 14, Inter SemiBold 13 white.
   - No filter pills on this frame.
3. **Empty state** (centred in the remaining space, vertical gap 16):
   - Circle 56, white, 1px `#e2e8f0`, radius 28, plus icon 24.
   - "No recipes yet" Inter Bold 16 `#0f172a`; "Create your first recipe to get started" Inter Regular 14 `#64748b` (gap 4).
   - Button "Create Recipe" — bg `#1a5c41`, radius 8, padding 10×20, gap 6, plus icon 14, Inter SemiBold 14 white.
4. **Populated list: not designed** — no frame in the wireframe shows it.

## "New Recipe" drawer (`Side-Sheet`)

- Overlay `rgba(0,0,0,0.4)` over the content area; sheet on the right, full height, **width 644** (wider than the ingredient drawer's 560), white, 1px `#e2e8f0`, padding 24, gap 20.
- **Header**: "New Recipe" Inter Bold 18 `#0f172a`; "Add details about your recipe" Inter Regular 13 `#64748b`; close "x" 20. Then a 1px divider.
- **Form** (vertical gap 24). Field style identical to the ingredient drawer (label Inter Medium 13 `#0f172a`, required "*" `#ef4444`, control white/1px `#e2e8f0`/radius 8/padding 12/Inter Regular 14, placeholder `#94a3b8`, select value `#0f172a` + chevron 14).
  1. **Top block** (row, gap 16):
     - **Image upload** — width 228, stretches to the fields' height, bg `#f8fafc`, 1px `#e2e8f0`, radius 8, padding 16, centred: image icon 24 + button "Upload image" (white, 1px `#e2e8f0`, radius 6, padding 6×12, Inter SemiBold 12 `#0f172a`).
     - **Fields** (column, gap 12): **Name** * ("Enter recipe name") · **Servings** * (numeric, "1") · **Description** (textarea, height 88, "Describe recipe"). *Label is misspelled "Desciption" in the wireframe — use "Description".*
  2. **"RECIPE DETAILS"** — section label Inter SemiBold 14 `#0f172a` **uppercase**, then 3 rows of 2 equal columns (row gap 16, column gap 16):
     - **Meal Type** * (select, "Select types" — plural, so multi-select) · **Difficulty** (select, "None")
     - **Prep Time (optional)** ("eg. 10 minutes") · **Cook Time (optional)** ("eg. 10 minutes")
     - **Allergens** (select, "Select") · **Dietary Preferences** (select, "Select")
- **Footer** (right, gap 12): "Cancel" (white, 1px `#e2e8f0`, Inter SemiBold 14 `#64748b`) · "Save Recipe" (bg `#1a5c41`, Inter SemiBold 14 white). Both radius 8, padding 10×16.

## Notable gaps for design review

- **No ingredients section in the recipe drawer, in any frame.** A recipe's ingredient list and amounts (and so its macros) are not designed.
- No instructions/steps field.
- Populated list layout (table vs cards), edit and detail states: not read.
