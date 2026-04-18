# Bootstrap mode

The first-run workflow. Produces a full documentation tree in Notion, rooted
at a single page, seeded from the current state of the repo.

## When this runs

- The user explicitly asks to bootstrap or rebuild the docs, **or**
- `Notion:notion-search` for `"GoodFellas — Fitness & Nutrition Platform"`
  returns no pages (nothing exists yet).

## End state

The page tree described in
[`page-templates.md`](page-templates.md#page-tree) exists in Notion,
populated with initial content derived from the repo. The Changelog page
exists but is empty. Every leaf page has the canonical "Recent changes"
footer section ready for `update` mode to append to.

## Steps

### 1. Locate or create the root page

- Run `Notion:notion-search` with query
  `GoodFellas — Fitness & Nutrition Platform`.
- If a page with that exact title exists under any parent the user controls,
  ask the user whether to reuse it or create a new one. Don't assume.
- If nothing exists, create it with `Notion:notion-create-pages`. Place it
  at the user's chosen workspace parent (ask if not obvious). The root page
  content is the `Root page` template in
  [`page-templates.md`](page-templates.md#root-page).
- Record the resulting `page_id`. Every subsequent create uses it as parent.

### 2. Scaffold the full sub-tree in one pass

Use a single `Notion:notion-create-pages` call with the multi-page form,
parented by the root `page_id`. The tree to create:

```
GoodFellas — Fitness & Nutrition Platform      (root)
├── Architecture & Conventions
│   ├── System overview
│   ├── Auth & roles
│   ├── SignalR realtime
│   ├── Storage (Postgres, Mongo, MinIO)
│   └── i18n & design tokens
├── Backend
│   ├── Features
│   ├── Entities (PostgreSQL)
│   ├── Documents (MongoDB)
│   └── Services
├── Web
│   ├── Pages
│   └── Components
├── Mobile
│   ├── Screens
│   └── Components
├── Prototypes
│   ├── Mobile prototype
│   ├── Trainer prototype
│   └── Notion portal
├── Domain glossary
└── Changelog
```

Each page starts with the stub from
[`page-templates.md`](page-templates.md). Don't populate leaf-per-feature
pages yet — those come in step 3. Create only the **hub** pages in this
pass.

### 3. Populate hub pages from the repo

Do these **in parallel** where possible (one sub-agent per hub) because
each branch is independent and reads from disjoint parts of the repo. See
[`page-templates.md`](page-templates.md) for the exact shape of each page.

#### 3a. Architecture & Conventions

Sources:
- `/CLAUDE.md` (root) — the high-level architecture, tech stack, quick start.
- `/.claude/CLAUDE.md` — orchestration rules, sub-agent routing.
- `/backend/FitnessPlatform.Application/Program.cs` + `Startup.cs` (if any)
  — auth, SignalR, middleware wiring.
- `/backend/FitnessPlatform.Application/Infrastructure/SignalR/` — hubs,
  presence tracker.
- `/backend/FitnessPlatform.Application/Domain/Constants/` — AppRoles,
  AppClaims, ErrorCodes.
- `/web/src/i18n/` and `/mobile/src/i18n/` — supported locales.
- `/mobile/src/constants/` — design tokens.

Do **not** inline the full contents of these files into Notion. Summarise
and link back with code-relative paths. Architecture pages should be
short enough to read in one sitting.

#### 3b. Backend

- **Features** hub: one sub-page per feature folder under
  `/backend/FitnessPlatform.Application/Features/` (Auth, Client,
  ClientMeasurements, ClientNutrition, ClientRequests, ClientTraining,
  Exercises, Foods, Messaging, NutritionPlans, Professionals,
  Questionnaires, Recipes, Trainers, TrainingPlans, Users, WorkoutLogs).
  Each sub-page uses the `Feature page` template and lists every endpoint
  in the folder (route, verb, roles, request/response shape at one line
  of prose). Skim each endpoint's `Configure()` method — don't read the
  whole source file.
- **Entities** hub: one sub-page per class under
  `/backend/FitnessPlatform.Application/Domain/Entities/`. Use the
  `Entity page` template. Fields + short relationship notes only.
- **Documents** hub: one sub-page per class under
  `/backend/FitnessPlatform.Application/Domain/Documents/`. Use the
  `Document page` template. Fields + collection name + note about the
  `Version` concurrency field where relevant.
- **Services** hub: list the files under
  `/backend/FitnessPlatform.Application/Infrastructure/Services/` with a
  one-line purpose each. No per-file sub-pages unless a service is
  genuinely complex (e.g. `MacroCalculator`).

#### 3c. Web

- **Pages** hub: one sub-page per file under `/web/src/pages/`. Use the
  `Web page` template. Route, purpose, query/mutation hooks used, i18n
  key prefix.
- **Components** hub: categorise by folder (`ui/`, `layout/`,
  `nutrition/`, `training/`, `questionnaire/`, `data/`, `domain/`) and
  list components with one-line descriptions. Don't sub-page per
  component — it's too granular for bootstrap.

#### 3d. Mobile

- **Screens** hub: one sub-page per file under `/mobile/app/` (including
  the `(auth)` and `(client)` groups). Use the `Mobile screen` template.
  Route path, auth state required, state sources (stores/queries),
  notable SignalR triggers.
- **Components** hub: categorise by folder
  (`ui/`, `today/`, `messages/`, `trainers/`, `training/`, `nutrition/`,
  `notifications/`, `questionnaire/`) and list components with one-line
  descriptions.

#### 3e. Prototypes

One sub-page per HTML prototype artefact:
- `Mobile prototype` ← `docs/mobile_prototype.html`
  (source: `docs/prototypes/mobile/`)
- `Trainer prototype` ← `docs/trainer_prototype.html`
  (source: `docs/prototypes/trainer/`)
- `Notion portal` ← `docs/notion_portal.html`
  (source: `docs/prototypes/notion/`)

Each page lists the scenes (grep the source tree for `ph-*` / `s-*` scene
IDs) and describes how to regenerate via `node docs/prototypes/build.mjs`.
See the `Prototype page` template.

#### 3f. Domain glossary

One page with a bulleted list of domain terms the codebase uses that
aren't self-explanatory (Nutrition Plan vs Training Plan vs Questionnaire
vs Workout Log, Client Request flow, Plan publish semantics, Version
field, External ID, Invite vs Request). Pull definitions from the root
`CLAUDE.md` and the relevant feature folders. Keep terse — one paragraph
max per term.

### 4. Create the Changelog page

Use the `Changelog` template. Empty body with a one-line intro:
> Each task that changes code, prototypes, or conventions appends a
> dated entry here. Newest first. Machine-maintained by the
> `notion-docs` skill.

### 5. Report back

Return a message listing:
- The root page URL.
- Counts: "X hub pages, Y feature pages, Z entity pages, …".
- Any warnings (files skipped, ambiguous mappings, auth errors).

Do **not** start an `update` pass in the same invocation. Bootstrap is a
standalone operation.

## Failure modes and how to handle them

- **No Notion access / auth fails.** Stop immediately. Tell the user to
  run `/plugin` and authenticate, don't create half a tree.
- **Root page already exists with non-zero content.** Ask the user:
  reuse, archive-and-rebuild, or abort. Never silently overwrite.
- **Partial failure mid-scaffold.** Record which hubs succeeded. Tell the
  user exactly which ones to rerun. The skill is idempotent on a
  per-hub basis — re-running step 3 against an existing hub page will
  update (not duplicate) sub-pages if you search before creating.
- **Rate limiting.** The Notion MCP can rate-limit on bulk creates.
  Batch into groups of ~10 pages per call.
