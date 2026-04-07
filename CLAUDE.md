# GoodFellas — Mobile App

## Project Overview

Fitness and nutrition platform for personal trainers and their clients.
This monorepo contains three packages:

- `/backend` — ASP.NET Core 10 API
- `/web` — React 18 + TypeScript + Vite + shadcn/ui (trainer web portal)
- `/mobile` — React Native + Expo SDK 52 (this project)

All work in this session is scoped to `/mobile` only. Do not modify `/backend`
or `/web` unless explicitly asked.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native 0.76, Expo SDK 52 |
| Routing | Expo Router v4 (file-based) |
| Language | TypeScript — strict mode, no `any` |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Persistence | react-native-mmkv |
| Auth storage | expo-secure-store |
| UI blur | expo-blur |
| Package manager | npm |

---

## Running the Project

```bash
cd mobile
npm install
npx expo start              # start dev server
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator
```

---

## Backend

- **Local dev URL:** `http://localhost:5000`
- **Android emulator:** use `http://10.0.2.2:5000` instead of localhost
- **Swagger docs:** `http://localhost:5000/swagger`
- **Auth:** JWT Bearer token — store in `expo-secure-store`, attach to every
  request as `Authorization: Bearer <token>`
- **Runtime:** .NET 10

The API base URL must be read from an environment variable:

```typescript
// lib/api.ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000'
```

Set `EXPO_PUBLIC_API_URL` in `.env.local` for local dev. Never hardcode the URL.

---

## API Types

Types are generated from the Swagger JSON using NSwag. The generated file and
API client already exist from the previous version — **do not delete them**:

- `src/api/generated.ts` — auto-generated types from Swagger, do not edit manually
- `src/api/client.ts` — hand-written wrappers around the generated client

To regenerate types after backend changes:

```bash
cd mobile
npm run generate:api   # reads /swagger JSON, overwrites src/api/generated.ts
```

Everything else in the project is being rewritten from scratch.

---

## File Structure

```
mobile/
  app/                        — Expo Router screens — rewrite from scratch
  src/api/                    — KEEP: generated.ts + client.ts from previous version
    _layout.tsx               — Root layout, AuthGuard, ThemeProvider
    (auth)/                   — Unauthenticated routes
      login.tsx
      register.tsx
      forgot-password.tsx
    (client)/                 — Authenticated client routes
      _layout.tsx             — Tab navigator
      index.tsx               — Today
      discover.tsx            — Find trainer
      plans.tsx               — Plans overview
      plans/[planId].tsx      — Plan detail
      profile.tsx             — Profile & progress
      questionnaire.tsx       — Onboarding questionnaire
  components/                 — Shared components (see task doc for full list)
    ui/
    training/
    nutrition/
    trainers/
    questionnaire/
  stores/                     — Zustand stores
    authStore.ts
    todayStore.ts
  lib/
    api.ts                    — API client (axios instance + interceptors)
    queryClient.ts            — TanStack Query client + MMKV persistence
  constants/
    colors.ts                 — Color palette (light + dark)
    typography.ts             — Type scale
    radius.ts                 — Border radius tokens
  hooks/
    useTheme.ts               — Returns correct color set for current scheme
```

---

## Design System

Design tokens are defined in `constants/`. Always import from there — never
use hardcoded color values or font sizes inline.

```typescript
import { Colors } from '@/constants/colors'
import { Type }   from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTheme } from '@/hooks/useTheme'

// In a component:
const colors = useTheme()
// colors.label, colors.gold, colors.bg2, etc.
```

Brand accent color is `#c9a84c` (gold). Use it for active tab indicators,
primary buttons, and key interactive states.

The visual style follows **iOS 26 design language** — see `docs/mobile_rewrite_task.md`
for the complete token definitions and screen-by-screen spec.

---

## Authentication Flow

```
App start
  └── status === 'unauthenticated'  →  (auth)/login
  └── status === 'authenticated'
        └── questionnaireStatus === 'pending'  →  (client)/questionnaire
        └── otherwise                          →  (client)/index
```

On login: save JWT to SecureStore, set `authStore.token`, set `status =
'authenticated'`. On logout: clear SecureStore, reset all stores.

---

## State Management Rules

- **Zustand** for auth state, today's data, and any UI state that spans multiple
  screens
- **TanStack Query** for all server data (lists, plan details, profile) — do not
  duplicate server data in Zustand
- **MMKV** for offline persistence — today's training and nutrition are cached
  via `persistQueryClient`, questionnaire answers are saved per-step

---

## Code Conventions

- Components: PascalCase, one per file, named export + default export
- Hooks: camelCase, prefix `use`
- Stores: camelCase, suffix `Store`
- API functions: camelCase, descriptive — `fetchClientPlans`, `submitQuestionnaire`
- No inline styles on layout-level components — use `StyleSheet.create`
- Inline styles are acceptable for small one-off tweaks only

```typescript
// Good
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
})

// Avoid
<View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
```

---

## Implementation Task

The full screen-by-screen specification, component list, and implementation
order is in:

```
docs/mobile_rewrite_task.md
```

**Always read that file before starting any implementation work.**

Implement one phase at a time and stop for confirmation before moving to the
next phase. The phases are:

1. Design system + base components
2. Navigation + AuthGuard
3. Today screen
4. Profile screen
5. Plans screen
6. Discover screen
7. Questionnaire

---

## What NOT to Do

- Do not modify `/backend` or `/web`
- Do not implement the trainer/coach section — that is a separate task
- Do not implement push notifications, in-app payments, or chat
- Do not hardcode colors, font sizes, or spacing — always use design tokens
- Do not use `any` — fix the type properly
- Do not install new dependencies without asking first