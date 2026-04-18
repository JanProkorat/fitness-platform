# Page templates

The canonical shape of each page type the skill produces. Treat these as
**structural** templates, not literal copy-paste content. The generator
fills in project-specific detail from the code.

Every leaf page ends with a `## Recent changes` section; `update.md`
appends dated bullets there.

---

## Page tree

```
GoodFellas — Fitness & Nutrition Platform       [Root page]
├── Architecture & Conventions                   [Architecture hub]
│   ├── System overview                          [Arch leaf]
│   ├── Auth & roles
│   ├── SignalR realtime
│   ├── Storage (Postgres, Mongo, MinIO)
│   └── i18n & design tokens
├── Backend                                      [Backend hub]
│   ├── Features                                 [Features hub]
│   │   ├── Auth, Client, ClientMeasurements, … [Feature page × ~18]
│   ├── Entities (PostgreSQL)                    [Entities hub]
│   │   └── User, Role, RefreshToken, …          [Entity page × ~22]
│   ├── Documents (MongoDB)                      [Documents hub]
│   │   └── TrainingWeek, Food, Recipe, …        [Document page × ~23]
│   └── Services
├── Web                                          [Web hub]
│   ├── Pages
│   │   └── LoginPage, DashboardPage, …          [Web page × ~21]
│   └── Components
├── Mobile                                       [Mobile hub]
│   ├── Screens
│   │   └── (auth)/login, (client)/index, …      [Mobile screen page × ~35]
│   └── Components
├── Prototypes
│   ├── Mobile prototype                         [Prototype page]
│   ├── Trainer prototype
│   └── Notion portal
├── Domain glossary
└── Changelog
```

---

## Root page

**Title:** `GoodFellas — Fitness & Nutrition Platform`

**Body:**
- Callout: "Canonical project documentation. Machine-maintained by the
  `notion-docs` skill. Don't hand-edit generated sections."
- One paragraph: multi-user fitness platform connecting trainers,
  nutritionists, and clients. 3 packages.
- Table: package → path → tech stack (from root `CLAUDE.md`).
- Links to each top-level hub page.
- "Recent cross-cutting changes" list (last 5 Changelog entries that
  touched >1 package; the skill trims this on each update).

---

## Architecture hub

**Title:** `Architecture & Conventions`

**Body:**
- One-paragraph intro pulled from root `CLAUDE.md` "Architecture" section.
- Links to the 5 sub-pages.
- Shared conventions list (i18n, API type generation, git branches, no
  hardcoded URLs, SignalR lowercase event names).

### Arch leaf pages

Each: intro paragraph, bullet list of current conventions, links to the
source files. Examples:

- **System overview**: diagram description + request flow (web/mobile →
  REST API → Postgres/Mongo; SignalR hub; MinIO for blobs).
- **Auth & roles**: AppRoles constants, JWT lifetimes, refresh rotation,
  invite flow in prose.
- **SignalR realtime**: hub path, event naming convention, presence.
- **Storage**: what's in Postgres vs Mongo vs MinIO; Version field rule
  for Mongo aggregates.
- **i18n & design tokens**: three locales; where design tokens live;
  rule "no hardcoded colors/spacing".

---

## Feature page

**Title:** `<Feature folder name>` (e.g. `Nutrition Plans`)

**Body sections:**
1. **Overview** — one paragraph: what the feature owns, which clients
   consume it.
2. **Endpoints** — table with columns: `Route` · `Verb` · `Roles` ·
   `Purpose` (one-liner per endpoint). Pull from the `Configure()`
   method of each endpoint in the folder.
3. **Related entities/documents** — links to Backend/Entities and
   Backend/Documents pages the feature reads/writes.
4. **Realtime events** — if the feature broadcasts any SignalR events,
   list them here with lowercase names.
5. **Recent changes** — running log, newest first (update mode appends).

---

## Entity page

**Title:** `<EntityClassName>`

**Body:**
1. **Purpose** — one sentence.
2. **Table** — table name (snake_case via EF).
3. **Fields** — bulleted list: name · type · nullability · short note.
   Only the interesting ones; routine audit fields can be "standard audit
   timestamps (CreatedAt, UpdatedAt)".
4. **Relationships** — bulleted: `→ OtherEntity (FK)` / `← OtherEntity`.
5. **Notes** — unique constraints, soft-delete flag, indexes worth
   mentioning.
6. **Recent changes**.

---

## Document page

**Title:** `<DocumentClassName>`

**Body:**
1. **Purpose** — one sentence.
2. **Collection** — MongoDB collection name.
3. **Versioning** — state whether it's a root aggregate (has `Version`
   concurrency field) or embedded.
4. **Fields** — bulleted list: name · type · short note. Group by
   conceptual section if the doc is large (e.g. `TrainingWeek` has
   sessions → exercises → sets).
5. **Indexes** — if any are declared.
6. **Recent changes**.

---

## Web page (route)

**Title:** `<PageComponentName>` (e.g. `NutritionPlansPage`)

**Body:**
1. **Route** — Vite/React Router path.
2. **Purpose** — one sentence.
3. **Data** — TanStack Query hooks the page uses; mutations.
4. **Key components** — list the top-level children from the page body.
5. **Realtime** — SignalR events the page subscribes to (via
   `useSignalR`).
6. **i18n keys** — key prefix(es) used.
7. **Recent changes**.

---

## Mobile screen page

**Title:** `<screen path>` (e.g. `(client)/nutrition/meal`)

**Body:**
1. **Route** — Expo Router path (file path).
2. **Auth state** — unauthenticated / authenticated / trainer-only /
   questionnaire-gated.
3. **State sources** — stores (Zustand), queries (TanStack), local state.
4. **Key components** — list from the screen body.
5. **Realtime** — SignalR events that invalidate queries on this screen.
6. **i18n keys** — key prefix(es).
7. **Recent changes**.

---

## Prototype page

**Title:** `<Prototype name>` (e.g. `Mobile prototype`)

**Body:**
1. **Artefact** — path to the generated HTML
   (e.g. `docs/mobile_prototype.html`).
2. **Source tree** — path to the `docs/prototypes/<name>/` folder.
3. **Build** — the one-line command: `node docs/prototypes/build.mjs`.
4. **Scenes** — table: `Scene ID` · `File` · `Purpose`. IDs grep from
   `scenes/*.html` (mobile/trainer use `ph-*`; notion uses `s-*`).
5. **Recent changes**.

---

## Changelog page

**Title:** `Changelog`

**Body:**
- Intro callout: "Each task that changes code, prototypes, or
  conventions appends a dated entry here. Newest first.
  Machine-maintained by the `notion-docs` skill."
- Entries appended in reverse-chronological order by `update` mode.

Entry format (exactly matches old PROGRESS.md so the muscle memory
transfers):

```
## YYYY-MM-DD — <one-line task summary>

### Backend (`/backend`)            ← only if the task touched backend

**Added: `Features/NutritionPlans/ArchivePlan/`:**
- Concrete bullets. Paths in backticks.
- Why when non-obvious.

**Modified: `Domain/Constants/ErrorCodes.cs`:**
- Added `PlanAlreadyArchived` code.

### Web (`/web`)                    ← only if touched

**Regenerated: `src/api/generated.ts`** via `npm run generate-api`.
```

Use `### Mobile (`/mobile`)` and `### Repo root (`.claude/`)` as the
other sub-headings. Omit headings for untouched packages.

---

## Domain glossary

**Title:** `Domain glossary`

**Body:** bulleted term → definition list. Target length: 15-25 terms.
Include at least: Nutrition Plan, Training Plan, Training Week,
Workout Log, Training Session, Exercise, Set, Food, Recipe, Meal,
Questionnaire, Client Request vs Invite, Version field, External ID,
Published vs Draft plan, Archive.
