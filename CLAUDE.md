# GoodFellas — Fitness & Nutrition Platform

## Project Overview

Multi-user fitness platform connecting personal trainers, nutritionists, and
their clients. Three-tier architecture: REST API, trainer web portal, client
mobile app.

| Package | Path | Tech |
|---|---|---|
| Backend API | `/backend` | ASP.NET Core 10, FastEndpoints, PostgreSQL + MongoDB |
| Web Portal | `/web` | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| Mobile App | `/mobile` | React Native 0.86, Expo SDK 57, Expo Router |

---

## Quick Start

```bash
# Backend (requires .NET 10, PostgreSQL, MongoDB)
cd backend/FitnessPlatform.Application
dotnet run                          # http://localhost:5000
dotnet run -- --seed                # seed exercise/food databases

# Web portal
cd web[progress.md](progress.md)
npm install
npm run dev                         # http://localhost:5173

# Mobile app
cd mobile
npm install
npx expo start --ios                # or --android

# End-to-end test harness (packaged backend + seeded fixture on :5101)
npm run e2e:up                      # docker compose up: postgres, mongo, minio, seed, api
npm run e2e:down                    # docker compose down -v
```

**Swagger docs (dev):** http://localhost:5000/swagger (HTTP) or https://localhost:5001/swagger (HTTPS)
**E2E Swagger:** https://localhost:5101/swagger (compose harness, dev cert; runs alongside dev API)
**E2E fixture credentials:** see `docs/testing/e2e-fixtures.md`
**API type generation:** `npm run generate-api` in `/web` (not set up yet in the fresh `/mobile`)

---

## Architecture

```
┌─────────────┐     ┌──────────────┐
│  Web Portal │────>│              │<────│ Mobile App  │
│  (React 19) │     │   REST API   │     │  (Expo 57) │
└─────────────┘     │  .NET 10     │     └─────────────┘
                    │  FastEndpts  │
                    └──────┬───────┘
                      ┌────┴────┐
                 PostgreSQL   MongoDB
                 (relational) (documents)
```

**PostgreSQL** — users, roles, auth tokens, client-trainer links, conversations,
notifications, questionnaires, measurements, audit logs.

**MongoDB** — nutrition plans, training plans, workout logs, foods, exercises,
recipes. Denormalized documents for fast reads without JOINs. Version field
for optimistic concurrency.

**SignalR** — real-time notifications, chat messages, typing indicators, presence.
Hub at `/hubs/notifications`.

**MinIO** — blob storage for progress photos and exercise videos.

---

## Backend (`/backend`)

### Structure

```
FitnessPlatform.Application/
  Domain/
    Entities/          — 22 EF Core entities (PostgreSQL)
    Documents/         — 23 MongoDB document classes
    Enums/             — 31 enums (roles, goals, plan status, etc.)
    Interfaces/        — 11 service interfaces
    Constants/         — AppRoles, AppClaims, ErrorCodes
  Features/            — 18 feature folders, ~116 endpoints total
    Auth/              — Register, Login, Refresh, Password reset, Invites
    Trainers/          — Client management, dashboards, progress
    NutritionPlans/    — CRUD, publish weeks, week-level versioning
    TrainingPlans/     — CRUD, publish weeks, session/exercise management
    Questionnaires/    — Templates, assignment, client responses
    ClientNutrition/   — Today's plan, meal logging, weekly overview
    ClientTraining/    — Today's session
    ClientMeasurements/— Body measurements, stats
    Messaging/         — Conversations, archive/unarchive
    Exercises/         — Exercise DB with localization
    Foods/             — Food DB, OpenFoodFacts integration
    Recipes/           — Recipe management
    WorkoutLogs/       — Training log CRUD
    Client/            — Client profile, invites, notifications
    Professionals/     — Public search, profiles
    Users/             — Profile management
    ClientRequests/    — Join request flow
  Infrastructure/
    Data/              — ApplicationDbContext (EF), MongoContext
    Services/          — 14 services (email, push, blob, macro calc, etc.)
    SignalR/           — NotificationHub, PresenceTracker
  Middleware/          — Global exception handler
FitnessPlatform.Tests/ — 88 test files, xUnit + Testcontainers
```

### Key conventions

- **FastEndpoints** pattern: one endpoint per file, `Configure()` + `HandleAsync()`
- Routes: `/{domain}/{resource}` (e.g. `/nutrition/plans/{planId}`)
- Client routes prefixed: `/client/...`
- Trainer routes prefixed: `/trainer/...` or `/{domain}/...` with Trainer role
- Auth: JWT Bearer, 15-min access token, 7-day refresh token
- Pagination: `page`/`pageSize` query params, `X-Total-Count` response header
- Errors: RFC 7807 Problem Details
- DB naming: snake_case via EF NamingConventions

### Running tests

```bash
cd backend
dotnet test    # requires Docker for Testcontainers (PostgreSQL + MongoDB)
```

---

## Web Portal (`/web`)

Trainer/nutritionist admin interface for managing clients, plans, and exercises.

### Structure

```
src/
  pages/           — 21 route pages (Login, Dashboard, Plans, Clients, etc.)
  components/
    ui/            — 12 headless Tailwind components (Button, Dialog, Input, etc.)
    layout/        — AppShell, Sidebar, TopNav, NotificationBell
    nutrition/     — 28 components (DayColumn, MealBlock, FoodSearch, MacroSliders)
    training/      — 15 components (DnD plan builder with @dnd-kit)
    questionnaire/ — 6 components (editor, preview, answers)
    data/          — DatabaseTable, CardGrid, StatsGrid
    domain/        — ActivityTimeline, FilterChips, MessageBubble
  api/             — 19 modules + NSwag-generated client
  stores/          — Zustand (auth, toast)
  hooks/           — useSignalR
  i18n/            — cs, en, de translations
  lib/             — Axios instance, error handling, utils
```

### Key conventions

- Path alias: `@/` maps to `./src/`
- Forms: React Hook Form + Zod validation
- Data fetching: TanStack React Query v5
- Real-time: SignalR via `useSignalR()` hook
- Auth: access token in memory, refresh token in localStorage
- API proxy: Vite dev server proxies `/auth`, `/users`, `/trainer`, `/nutrition`,
  `/training`, `/foods`, `/exercises`, `/conversations`, `/hubs` to `https://localhost:5001`
- No test suite currently

---

## Mobile App (`/mobile`)

Client app (iOS + Android), restarted from a fresh `create-expo-app`
project in #1160 for the Form Up redesign. No features yet — screens are
rebuilt against the `Glass*` (client) and `Coach*` (coach) boards. The old
app is in git history before #1160.

### Structure

```
src/app/         — Expo Router screens (`_layout.tsx` + `index.tsx` only)
assets/          — icons and splash images
scripts/         — trust-dev-cert.sh (simulator trusts the .NET dev cert)
AGENTS.md        — Expo's own guidance for this SDK (read before Expo APIs)
```

Non-route code (components, hooks, stores, API) goes under `src/`, outside
`src/app/`. i18n, the API client, design tokens and state management are not
set up yet — each lands with the first screen that needs it.

### Key conventions

- TypeScript strict mode, no `any`
- Never hardcode colors, fonts or spacing — use the design tokens once they exist
- `StyleSheet.create` for layout styles; inline only for small tweaks
- Add packages with `npx expo install`, and discuss new dependencies first
- Verify: `npm run typecheck` and `npm run expo-doctor`

---

## Shared Conventions

- **i18n**: Supported locales `cs` (primary), `en`, `de`; files at
  `web/src/i18n/locales/*.json` and `mobile/src/i18n/locales/*.json` (backend
  is locale-agnostic — validator messages are culture-neutral keys)
- **API types**: Generated from Swagger via NSwag — do not edit `generated.ts`
- **Git**: `main` branch for releases, `develop` for active work
- **No hardcoded URLs**: API base URL from env/config
- **SignalR events**: lowercase names (`newmessage`, `nutritionplanpublished`, etc.)

---

## What NOT to Do

- Do not edit `src/api/generated.ts` in web or mobile — it's auto-generated
- Do not hardcode colors, fonts, or spacing — use design tokens
- Do not use `any` in TypeScript — fix the type properly
- Do not install new dependencies without discussing first
- Do not skip pre-commit hooks or force-push to main

---

## Working Principles

The global `~/.claude/CLAUDE.md` Working Principles apply unchanged (root-cause
first, verify before done, scope discipline, two-attempt UI rule, plan-then-execute,
token hygiene, no verbatim spec in subagent prompts). This repo adds only:

- **Root cause in handoffs.** If a bug comes from a sub-agent's handoff, re-dispatch
  with the root cause named — sub-agents never proceed on a speculative fix.
- **Verification surface per package.** Backend: `dotnet build` + the relevant
  `dotnet test` slice. Web: `npm run build`. Mobile: `npm run typecheck`, and for
  UI/animation work a simulator check or an explicit user check.
- **Scoped backend runs need the MTP filter syntax.** Plain `dotnet test --filter`
  is silently ignored by the xunit v3 runner and runs the whole suite. Use
  `dotnet test <csproj> -- --filter-class "<FQN>"` and reconcile the reported total.
- **`build-and-test` green means the full suite passed** (no `-class-` exclusions
  since #876). If a class must ever be skipped in CI, give it its own one-line
  reason and tracking issue — a blanket comment let 207 tests go unrun for months.
- **Plans** go to `PLAN.md` (or `PLAN-<topic>.md`) at the repo root.
- **Fresh context before `ship-epic`**; `ship-epic` and `signalr-event` must not
  paste issue bodies into child prompts.
