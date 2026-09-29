# Ingredients page — design inventory

> **Maintainer decisions (2026-09-28, issue #1115) override the wireframe where they differ:**
> no SKU search (placeholder "Search ingredients…") and no "Type" pill; the Tags pill stays (tags are
> added to foods); Unit + Serving Size is one required default serving stored as the first
> `CommonServings` entry; allergens = fixed EU 14 list, dietary preferences = new fixed list.

Source: Figma `Qi8EpYD2b0e717hvi2bbVq`, page "⚡Wireframe", frame **`ingredients-02`** (node `1:14358`, 1920×1080), read via `get_design_context` on 2026-09-28.
**`ingredients-01`** (node `1:14022`) was not read through Figma (Starter limit reached); its PNG export shows the same list **without** the drawer — identical title, search, filter pills, table, sample rows and pagination to the values below. Renders: `ingredients-01.png` (list), `ingredients-02.png` (list + New Ingredient drawer).

The app shell (dark sidebar, nav groups) is already built (#1073/#1076); the only shell difference here is that **Nutrition → Ingredients** is the active item (bg `#1e1e22`, label white).

## Page (`Main-Content`, bg `#f8fafc`, padding 32, vertical gap 24)

1. **Title** "Ingredients" — Inter Bold 28, `#0f172a`.
2. **Filters bar** (vertical gap 12):
   - Row 1, space-between:
     - **Search** — white, 1px `#e2e8f0`, radius 8, padding 8×12, width 280, gap 8; search icon 16; placeholder "Search ingredients by name, SKU..." Inter Regular 13 `#94a3b8`.
     - **CTA** "+ New Ingredient" — bg `#115e59`, radius 8, padding 10×18, Inter SemiBold 13 `#f8fafc`. *(Note: a different green from the drawer's save button `#1a5c41` and the recipes CTA — likely a wireframe inconsistency; use the existing primary button token.)*
   - Row 2, three filter pills (gap 12): "Category", "Tags", "Type" — white, 1px `#e2e8f0`, radius 100 (pill), padding 6×12, gap 6, leading plus icon 12, Inter Regular 13 `#475569`.
3. **Table card** — white, 1px `#e2e8f0`, radius 12, clips content, fills the remaining height.
   - **Header row** — bg `#f8fafc`, bottom border `#e2e8f0`, padding 12×20, gap 16, Inter SemiBold 13 `#64748b`. Columns: **Name** (flex 1) · **Calories** (120) · **Nutrients** (180) · **Category** (180) · **Library** (100).
   - **Body rows** — bottom border `#e2e8f0`, padding 12×20, gap 16, vertically centred:
     - Name — Inter SemiBold 14 `#0f172a`, wraps.
     - Calories — Inter Medium 13 `#475569`, format `"{n} kcal / 100g"`.
     - Nutrients — three inline items, gap 8, Inter Regular 12 `#64748b`: `"P: {n} g"`, `"C: {n} g"`, `"F: {n} g"`.
     - Category — Inter Regular 13 `#475569` (e.g. "Vegan and Vegetarian", "Fruits and Vegetables", "Fish and Seafood", "Snacks and Sweets", "Beverages", "Other").
     - Library — badge: bg `#f1f5f9`, radius 4, padding 2×8, Inter SemiBold 11 `#475569`, text "System" in every sample row (the other value is presumably the coach's own library).
   - Sample data is alphabetical ("Almond drink, unfortified", "Almondmilk, with added calcium", "Almond, raw", "Almonds", "American inspired cookie", …).
4. **Pagination footer** (space-between):
   - Left: "Viewing 25 of 1819" — Inter Regular 13 `#64748b`.
   - Right (gap 8): "Previous" · 1 · 2 · 3 · 4 · … · 71 · "Next". Each: 1px `#e2e8f0`, radius 6, padding 6×12, Inter 13 (Medium for Prev/Next, SemiBold for numbers). Page buttons white bg, text `#475569`; **current page** bg `#475569`, text `#f8fafc`. Prev/Next have no fill.
   - Implies server paging at 25 per page (1819 items / 25 ≈ 73; the "71" is wireframe filler).

## "New Ingredient" drawer (`Side-Sheet`)

- Overlay `rgba(0,0,0,0.4)` over the content area only (not the sidebar).
- Sheet: right edge, full height, **width 560**, white, 1px `#e2e8f0`, padding 24, vertical gap 20.
- **Header** (space-between): title "New Ingredient" Inter Bold 18 `#0f172a`; subtitle "Add a new ingredient to your library" Inter Regular 13 `#64748b` (gap 4); close "x" icon 20.
- 1px divider line.
- **Form** (vertical gap 24), three sections. Each section: header row (icon 16 + label Inter SemiBold 14 `#0f172a`, gap 8), then fields (gap 16). Field: label Inter Medium 13 `#0f172a` + required "*" Inter Regular 13 `#ef4444` (gap 4); control 6px below — white, 1px `#e2e8f0`, radius 8, padding 12, text Inter Regular 14 (placeholder `#94a3b8`, select value `#0f172a` + chevron 14).
  1. **Basic Information** (icon `info`) — one row, 2 equal columns: **Name** * (input, "Enter name") · **Category** * (select, "Select category").
  2. **Nutritional Information** (icon `activity`) — row of 4 equal columns (gap 12): **Calories / 100g** * · **Protein / 100g** * · **Carbs / 100g** * · **Fat / 100g** * (numeric inputs, placeholder "0"); then row of 2 (gap 16): **Unit** * (select, value "Portion") · **Serving Size** * (numeric, "0").
  3. **Tags & Classification** (icon `tag`) — row of 2: **Dietary Preferences** (select, "Select preferences") · **Contains Allergens** (select, "Select allergens"). Not required.
- **Footer** (right-aligned, gap 12): "Cancel" (white, 1px `#e2e8f0`, radius 8, padding 10×16, Inter SemiBold 14 `#64748b`) · "Save Ingredient" (bg `#1a5c41`, radius 8, padding 10×16, Inter SemiBold 14 white).

## Open questions for design review

- "Type" filter pill: which field it filters on (the drawer has no "Type" field).
- "Library" column values beyond "System".
- Edit and detail states of the drawer are not in the frames read so far.
