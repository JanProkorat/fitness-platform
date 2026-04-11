# GoodFellas — Fitness & Nutrition Platform

## Project Overview

Multi-user fitness platform connecting personal trainers, nutritionists, and
their clients. Three-tier architecture: REST API, trainer web portal, client
mobile app.

| Package | Path | Tech |
|---|---|---|
| Backend API | `/backend` | ASP.NET Core 10, FastEndpoints, PostgreSQL + MongoDB |
| Web Portal | `/web` | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| Mobile App | `/mobile` | React Native 0.83, Expo SDK 55, Expo Router |

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
```

**Swagger docs:** http://localhost:5000/swagger
**API type generation:** `npm run generate-api` in `/web` or `/mobile`

---

## Architecture

```
┌─────────────┐     ┌──────────────┐
│  Web Portal │────>│              │<────│ Mobile App  │
│  (React 19) │     │   REST API   │     │  (Expo 55) │
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

Client-facing app (iOS + Android). Trainers see a simplified admin view.

### Structure

```
app/                           — Expo Router file-based screens (35 files)
  (auth)/                      — Login, Register, Verify email, Questionnaire
  (client)/                    — Tab navigator (Today, Messages, Discover, Plans, Profile)
    training/                  — Session detail, workout logging, history
    nutrition/                 — Meal detail, shopping list, week overview
    measurements/              — Body measurements
    messages/                  — Chat threads, archived
    discover/                  — Trainer search, profiles, invite
src/
  api/             — 12 modules (axios client, SignalR, domain APIs)
  components/      — 60 components across 8 folders
    ui/            — 15 primitives (Avatar, Badge, GoldButton, MacroBar, etc.)
    today/         — 7 (HasTrainerState, NoTrainerState, PlanPendingState, etc.)
    messages/      — 10 (ChatInputBar, MessageBubble, ConversationRow, etc.)
    trainers/      — 8 (TrainerCard, DiscoveryFilters, SendInviteSheet, etc.)
    training/      — 3 (TrainingCard, ExerciseRow, SessionChip)
    nutrition/     — 2 (NutritionCard, MealRow)
    notifications/ — 5 (NotificationSheet, InviteCard, QuestionnaireBanner)
    questionnaire/ — 3 (QuestionScreen, RadioGroup, ScaleInput)
  hooks/           — 11 custom hooks
  stores/          — 5 Zustand stores (auth, today, messages, theme, offline)
  constants/       — Design tokens (colors, typography, radius)
  i18n/            — cs, en, de translations
  lib/             — queryClient, toast
```

### Key conventions

- TypeScript strict mode, no `any`
- Design tokens in `constants/` — always use `useTheme()`, never hardcode colors
- Brand accent: `#c9a84c` (gold)
- `StyleSheet.create` for layout styles; inline only for small tweaks
- Components: PascalCase, named export + default export
- State: Zustand for app state, TanStack Query for server data, MMKV for persistence
- Real-time: SignalR events drive query invalidation (no polling)
- Auth: JWT in memory, refresh token rotation, auto-retry on 401

### Auth flow

```
App start → restore session from SecureStore
  ├── unauthenticated → (auth)/login
  └── authenticated
       ├── pending questionnaire → (client)/questionnaire
       └── ready → (client)/index (Today screen)
```

### Today screen states

```
useTodayState() resolves:
  no-trainer    → NoTrainerState (find trainer CTA)
  plan-pending  → PlanPendingState (plan banners, schedule preview)
  has-trainer   → HasTrainerState (stats, training card, nutrition card)
```

---

## Shared Conventions

- **i18n**: All three packages support Czech, English, German
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
