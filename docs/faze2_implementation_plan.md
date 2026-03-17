# Phase 2: Nutrition Module Implementation Plan

## Context

Phase 1 delivered auth, user management, trainer-client linking, and the web portal shell. Phase 2 adds the core nutrition module: a food database backed by MongoDB + Open Food Facts, nutrition plan CRUD for nutritionists, client-facing meal tracking, body measurements, a web plan editor, and a React Native mobile app. This is the functionally most complex phase of the project.

**Workflow:** Step-by-step — each step is implemented, then reviewed before proceeding.

---

## Step 1: MongoDB Infrastructure Setup

**Goal:** Wire MongoDB into DI, create the `IMongoContext` abstraction, configure indexes at startup.

**Files to create:**
- `Infrastructure/Data/MongoDb/IMongoContext.cs` — interface exposing `IMongoCollection<Food> Foods` and `IMongoCollection<NutritionPlan> NutritionPlans` (extended later)
- `Infrastructure/Data/MongoDb/MongoContext.cs` — implementation taking `IMongoDatabase`, exposes typed collections
- `Infrastructure/Data/MongoDb/MongoIndexInitializer.cs` — `IHostedService` that creates: text index on `foods.name`, unique sparse on `foods.barcode`, compound index on `nutrition_plans.clientId + status`
- `Domain/Constants/MongoCollections.cs` — collection name constants (`"foods"`, `"nutrition_plans"`, `"meal_logs"`)

**Files to modify:**
- `Program.cs` — register `IMongoDatabase` as singleton from existing `mongoConnection` (line 42-44, currently unused), register `IMongoContext`, register `MongoIndexInitializer`
- `appsettings.json` — add `MongoDB:DatabaseName` if not already present

**Pattern:** Mirrors `IApplicationDbContext` for PostgreSQL — a testable interface injected into endpoints.

**Tests:**
- Add `Testcontainers.MongoDb` NuGet to test project
- Create `Tests/Builders/MockMongoBuilder.cs` for unit test mocking
- Extend `FitnessApiFactory` to start a MongoDB testcontainer alongside PostgreSQL

**Verify:** `make backend` starts without errors, MongoDB connection logged by Serilog.

---

## Step 2: Food Document Model + Seed Data

**Goal:** Define the `Food` MongoDB document and seed 30-50 common foods.

**Files to create:**
- `Domain/Documents/Food.cs` — POCO with `[BsonId] ObjectId Id`, `Guid ExternalId`, `string Name`, `string? Source` (system/custom/openfoodfacts), `string? Barcode`, `NutrientsPer100g Per100g` (embedded), `List<string> Allergens`, `List<ServingSize> CommonServings`, `bool IsVerified`, `Guid? NutritionistId`, `bool IsDeleted`, `DateTime DateCreated`, `DateTime? DateUpdated`
- `Domain/Documents/NutrientsPer100g.cs` — embedded: `decimal Kcal`, `decimal Protein`, `decimal Carbs`, `decimal Fat`, `decimal? Fiber`, `decimal? Sugar`, `decimal? SaturatedFat`, `decimal? Salt`
- `Domain/Documents/ServingSize.cs` — embedded: `string Label`, `decimal WeightG`
- `Infrastructure/Data/MongoDb/FoodSeedData.cs` — static list of 30-50 common foods (chicken breast, rice, banana, eggs, oats, etc.) with accurate per100g macros
- `Infrastructure/Data/MongoDb/MongoSeeder.cs` — called from `Program.cs --seed` path, inserts seed foods if collection is empty

**Design notes:**
- MongoDB documents do NOT inherit from EF base entities. They are standalone POCOs with `[BsonElement]` attributes.
- `Guid ExternalId` serves the same role as `PublicId` in EF entities (API-facing ID).

**Files to modify:**
- `Program.cs` — extend `--seed` block to call `MongoSeeder`

**Verify:** `make seed` populates MongoDB `foods` collection; verify via Adminer or `mongosh`.

---

## Step 3: Open Food Facts Integration

**Goal:** External food data fetching with caching and resilience.

**Files to create:**
- `Domain/Interfaces/IFoodExternalService.cs` — `SearchByBarcodeAsync(string barcode)`, `SearchByNameAsync(string query, int limit)`
- `Infrastructure/Services/OpenFoodFactsService.cs` — implements `IFoodExternalService`, uses `HttpClient` to call OFF search and barcode endpoints
- `Infrastructure/Services/OpenFoodFactsModels.cs` — internal deserialization DTOs for OFF API responses

**Files to modify:**
- `Program.cs` — register typed `HttpClient` for OFF with `AddHttpClient<IFoodExternalService, OpenFoodFactsService>()`, configure Polly retry (3x exponential backoff via `Microsoft.Extensions.Resilience`), 5s timeout
- `appsettings.json` — add `OpenFoodFacts:BaseUrl`, `OpenFoodFacts:TimeoutSeconds`, `OpenFoodFacts:CacheDays`

**Behavior:**
- Barcode lookup: check MongoDB first (cache hit if < 30 days old), if miss → call OFF API → store result with `Source="openfoodfacts"`, `IsVerified=false` → return
- Name search: search local MongoDB text index first, supplement with OFF results if fewer than `pageSize` results
- Map OFF JSON → internal `Food` document (normalize units, handle missing fields)

**Tests:**
- Unit test `OpenFoodFactsService` with mocked `HttpMessageHandler`
- Test mapping from OFF JSON format to `Food` document
- Test cache hit/miss logic with mocked `IMongoContext`

**Verify:** `make test` passes; manual test with curl against a real barcode.

---

## Step 4: Food CRUD Endpoints

**Goal:** 7 food endpoints as vertical slices.

**Feature folders to create (each with Endpoint, Request, Response, Validator):**

| Endpoint | Route | Auth | Description |
|----------|-------|------|-------------|
| `SearchFoods` | `GET /foods/search?q=&category=&source=&page=&pageSize=` | Any authenticated | Fulltext search, paginated |
| `GetFood` | `GET /foods/{foodId}` | Any authenticated | Detail by ExternalId |
| `GetFoodByBarcode` | `GET /foods/barcode/{barcode}` | Any authenticated | Cache-first, then OFF |
| `CreateFood` | `POST /foods` | Nutritionist | Custom food, sets NutritionistId |
| `UpdateFood` | `PUT /foods/{foodId}` | Nutritionist (owner) | Owner-only edit |
| `DeleteFood` | `DELETE /foods/{foodId}` | Nutritionist (owner) | Soft delete (IsDeleted=true) |
| `GetCustomFoods` | `GET /foods/custom` | Nutritionist | Own custom foods, paginated |

**Shared files:**
- `Features/Foods/Shared/FoodSummary.cs` — common response DTO
- `Features/Foods/Shared/NutrientValidation.cs` — static helper: validates kcal ≈ protein*4 + carbs*4 + fat*9 within 10% tolerance

**Tests:** Unit test each endpoint with mocked `IMongoContext`. Validator tests for `CreateFoodValidator` (kcal tolerance).

**Verify:** `make test`; `make backend` + Swagger UI to test search/barcode endpoints. Run `make generate-api` to regenerate NSwag client.

---

## Step 5: Nutrition Plan Document Model + MacroCalculatorService

**Goal:** Define the nutrition plan MongoDB document and the macro calculation service.

**Files to create:**
- `Domain/Documents/NutritionPlan.cs` — `ObjectId Id`, `Guid ExternalId`, `Guid ClientId`, `Guid NutritionistId`, `string Name`, `PlanStatus Status`, `GlobalNutritionSettings? GlobalSettings`, `List<PlanWeek> Weeks`, `int Version` (optimistic locking), timestamps
- `Domain/Documents/PlanWeek.cs` — embedded: `int WeekNumber`, `List<PlanDay> Days`
- `Domain/Documents/PlanDay.cs` — embedded: `int DayOfWeek` (1-7), `List<PlanMeal> Meals`, `NutrientTotals? DayTotals`
- `Domain/Documents/PlanMeal.cs` — embedded: `Guid MealId`, `string Name`, `int Order`, `string? Time`, `List<MealFood> Foods`, `NutrientTotals? MealTotals`
- `Domain/Documents/MealFood.cs` — embedded (denormalized): `Guid FoodExternalId`, `string FoodName`, `NutrientsPer100g Per100g`, `decimal AmountG`
- `Domain/Documents/GlobalNutritionSettings.cs` — `decimal? DailyKcal`, `decimal? ProteinG`, `decimal? CarbsG`, `decimal? FatG`
- `Domain/Documents/NutrientTotals.cs` — computed: `decimal Kcal`, `decimal Protein`, `decimal Carbs`, `decimal Fat`
- `Domain/Documents/MealLog.cs` — separate collection: `Guid ClientId`, `Guid PlanId`, `Guid MealId`, `DateTime EatenAt`, `List<MealFood> FoodsEaten`
- `Domain/Enums/PlanStatus.cs` — `Draft`, `Active`, `Archived`
- `Domain/Interfaces/IMacroCalculatorService.cs`
- `Infrastructure/Services/MacroCalculatorService.cs`:
  - Atwater conversion: kcal = protein*4 + carbs*4 + fat*9
  - BMR (Mifflin-St Jeor): men = 10*kg + 6.25*cm - 5*age + 5, women = 10*kg + 6.25*cm - 5*age - 161
  - TDEE: BMR * activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9)
  - Deficit/surplus: -20% cut, +10% bulk, 0% maintain
  - Default macro split: 30% protein, 45% carbs, 25% fat (adjustable)
  - `RecalculateTotals(NutritionPlan plan)` — recomputes all meal/day totals

**Modify IMongoContext:** Add `IMongoCollection<NutritionPlan> NutritionPlans` and `IMongoCollection<MealLog> MealLogs`

**Tests:** Extensive unit tests for `MacroCalculatorService` — BMR male/female, all activity levels, edge cases. Register service in `Program.cs`.

**Verify:** `make test` passes.

---

## Step 6: Nutrition Plan CRUD Endpoints (Nutritionist)

**Goal:** Full plan management API for nutritionists.

**Feature folders (each as vertical slice):**

| Endpoint | Route | Description |
|----------|-------|-------------|
| `CreatePlan` | `POST /nutrition/plans` | New draft plan for a client |
| `GetPlans` | `GET /nutrition/plans?clientId=&status=` | List plans (paginated, filtered) |
| `GetPlan` | `GET /nutrition/plans/{planId}` | Full plan document |
| `UpdatePlan` | `PUT /nutrition/plans/{planId}` | Update name, globalSettings. Optimistic lock via Version field → 409 on conflict |
| `DeletePlan` | `DELETE /nutrition/plans/{planId}` | Soft delete (status=Archived) |
| `PublishPlan` | `POST /nutrition/plans/{planId}/publish` | Draft → Active, client can see it |
| `DuplicatePlan` | `POST /nutrition/plans/{planId}/duplicate` | Copy plan as template |
| `UpdateDay` | `PUT /nutrition/plans/{planId}/weeks/{w}/days/{d}` | Overwrite entire day |
| `AddMeal` | `POST /nutrition/plans/{planId}/weeks/{w}/days/{d}/meals` | Add meal to day |
| `UpdateMeal` | `PUT /nutrition/plans/{planId}/weeks/{w}/days/{d}/meals/{mealId}` | Edit meal |
| `DeleteMeal` | `DELETE /nutrition/plans/{planId}/weeks/{w}/days/{d}/meals/{mealId}` | Remove meal |
| `AddFoodToMeal` | `POST .../meals/{mealId}/foods` | Add food (denormalized from foods collection) |
| `RemoveFoodFromMeal` | `DELETE .../meals/{mealId}/foods/{foodExternalId}` | Remove food |

**Cross-cutting:**
- All nutritionist endpoints verify `ClientTrainerLink` between JWT user and plan's clientId (cross-DB: read PostgreSQL, write MongoDB)
- After any food add/remove/quantity change → call `MacroCalculatorService.RecalculateTotals()` before saving
- Create shared auth helper: `Infrastructure/Services/NutritionAuthHelper.cs` — verifies trainer-client link

**Tests:** Unit test each endpoint. Test optimistic locking (version mismatch → 409). Test authorization (wrong nutritionist).

**Verify:** `make test`; Swagger UI CRUD flow. Run `make generate-api`.

---

## Step 7: Client Nutrition + Measurement Endpoints

**Goal:** Client-facing read/write for nutrition tracking and body measurements.

**Feature folders:**

| Endpoint | Route | Description |
|----------|-------|-------------|
| `GetTodayPlan` | `GET /client/nutrition/plan/today` | Active plan, correct day by date cycle |
| `GetWeekPlan` | `GET /client/nutrition/plan/week` | Current week's meals |
| `LogMealEaten` | `POST /client/nutrition/log/meals/{mealId}/eaten` | Mark meal as eaten (writes MealLog) |
| `GetTodayLog` | `GET /client/nutrition/log/today` | What client ate today + remaining macros |
| `GetShoppingList` | `GET /client/nutrition/plan/shopping-list?weekFrom=&weekTo=` | Aggregated + grouped by category |
| `CalculateGoals` | `POST /nutrition/clients/{clientId}/calculate-goals` | BMR/TDEE calculation from anamnesis |
| `AddMeasurement` | `POST /client/measurements` | New body measurement (uses existing PG entity) |
| `GetMeasurements` | `GET /client/measurements?from=&to=` | History, paginated |
| `GetLatestMeasurement` | `GET /client/measurements/latest` | Latest measurement |
| `GetMeasurementStats` | `GET /client/measurements/stats` | Min, max, avg, 30-day trend |
| `GetClientMeasurements` | `GET /trainer/clients/{clientId}/measurements` | Trainer view (GDPR audit logged) |

**Key logic:**
- `GetTodayPlan`: find active plan → calculate week/day from plan publish date and current UTC date → return correct day
- `GetShoppingList`: load plan weeks in range → aggregate all foods → group by category → sum amounts
- Measurement endpoints reuse existing `BodyMeasurement` entity in PostgreSQL

**Tests:** Unit tests, especially date-cycling logic for today's plan and shopping list aggregation.

**Verify:** `make test`; Swagger UI. Run `make generate-api`.

---

## Step 8: Client Progress & Compliance Endpoints

**Goal:** Compliance scoring, streaks, weekly overview for trainer dashboards.

**Files to create:**
- `Domain/Interfaces/IComplianceService.cs`
- `Infrastructure/Services/ComplianceService.cs` — compliance % (meals logged / planned), streak counter (consecutive days ≥ 80%), weekly macro averages
- `Features/Client/Progress/GetComplianceScore/` — `GET /client/progress/compliance`
- `Features/Client/Progress/GetWeeklyOverview/` — `GET /client/progress/weekly`
- `Features/Trainers/GetClientProgress/` — `GET /trainer/clients/{clientId}/progress` (with GDPR audit)
- `Features/Trainers/GetClientDashboard/` — enhance existing endpoint with compliance + measurements

**Tests:** ComplianceService with full/partial/zero compliance scenarios. Streak edge cases.

**Verify:** `make test`; `make generate-api`.

---

## Step 9: Web — Food Database UI

**Goal:** Food management page for nutritionists.

**New packages:** `@tanstack/react-table`

**Files to create:**
- `web/src/components/nutrition/NutritionBadge.tsx` — colored pill for P/C/F values
- `web/src/components/nutrition/FoodSearch.tsx` — debounced fulltext search + category filter, infinite scroll or pagination, returns selected food via callback
- `web/src/components/nutrition/AddFoodDialog.tsx` — React Hook Form + Zod, creates custom food
- `web/src/pages/FoodsPage.tsx` — TanStack Table with server-side pagination, search, isVerified badges

**Files to modify:**
- `web/src/App.tsx` — add `/foods` route inside RoleGuard block
- `web/src/components/layout/Sidebar.tsx` — add "Foods" nav item
- `web/src/api/client.ts` — re-export new food types after NSwag regeneration
- `web/src/i18n/locales/{en,cs,de}.json` — add `foods.*` translation keys
- `web/vite.config.ts` — add `/foods` proxy entry (if needed)

**Verify:** `make web`, navigate to `/foods`, search works, create custom food works.

---

## Step 10: Web — Nutrition Plan Editor

**Goal:** The main weekly plan editor for nutritionists.

**Files to create:**
- `web/src/hooks/useDebounce.ts` — generic debounce hook
- `web/src/hooks/useUnsavedChanges.ts` — dirty state + beforeunload warning
- `web/src/stores/nutritionPlan.ts` — Zustand store for plan editing: holds full plan, actions for add/remove/update foods and meals, computes macro totals, tracks `isDirty`. Debounced auto-save (2s) via PUT endpoint.
- `web/src/components/nutrition/DayColumn.tsx` — one day card: stacked MealCards, daily macro progress bars, warning if kcal > 115% of goal
- `web/src/components/nutrition/MealCard.tsx` — expandable card with food table (name, grams input, kcal, P, C, F), AddFoodRow at bottom
- `web/src/components/nutrition/AddFoodRow.tsx` — inline FoodSearch popover, adds food with default 100g
- `web/src/components/nutrition/MacroProgressBar.tsx` — reusable colored progress bar
- `web/src/components/nutrition/PlanToolbar.tsx` — unsaved indicator, copy-day dropdown, Publish button
- `web/src/pages/NutritionPlanPage.tsx` — fetches plan, hydrates Zustand store, renders 7 DayColumns in horizontal scroll, auto-save logic

**Files to modify:**
- `web/src/App.tsx` — add `/plans/nutrition/:planId` route
- `web/src/i18n/locales/{en,cs,de}.json` — add `nutrition.*` keys

**State management:** Zustand local store for editing (instant UI) + debounced PUT to server. TanStack Query for initial fetch only. This avoids complex optimistic mutation logic for rapid micro-edits (changing gram values).

**Verify:** `make web`, create a plan via Swagger, open editor, add foods, see live macro updates, publish.

---

## Step 11: Web — Client Nutrition Goals Page

**Goal:** Nutritionist sets client's macro goals with BMR/TDEE calculator.

**Files to create:**
- `web/src/components/nutrition/AnamnesiForm.tsx` — age, gender, height, weight, goal (cut/maintain/bulk), activity level
- `web/src/components/nutrition/GoalCalculation.tsx` — transparent display: BMR → TDEE → deficit → final kcal
- `web/src/components/nutrition/MacroSliders.tsx` — P/C/F % sliders that sum to 100, with SVG donut chart (no extra lib)
- `web/src/components/nutrition/MealDistribution.tsx` — 5 meals with % of daily kcal
- `web/src/pages/ClientNutritionGoalsPage.tsx` — combines all sections, calls POST /calculate-goals, saves via PUT

**Files to modify:**
- `web/src/App.tsx` — add `/clients/:id/nutrition-goals` route
- `web/src/pages/ClientDetailPage.tsx` — link to nutrition goals page
- `web/src/i18n/locales/{en,cs,de}.json` — add `nutritionGoals.*` keys

**Verify:** `make web`, navigate to client → nutrition goals, fill anamnesis, see BMR/TDEE, adjust macros, save.

---

## Step 12: Mobile — Expo Project Setup + Auth

**Goal:** Bootstrap React Native app with Expo Router, auth flow, API client.

**Create project:**
- `npx create-expo-app mobile --template expo-router` in project root

**Install dependencies:**
- `@tanstack/react-query`, `@tanstack/query-sync-storage-persister`, `@tanstack/react-query-persist-client`
- `zustand`, `react-native-mmkv`
- `axios`
- `@react-native-community/netinfo`
- `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-notifications`
- `victory-native`, `react-native-svg`
- `zod`, `react-hook-form`, `@hookform/resolvers`

**File structure:**
```
mobile/
├── app/
│   ├── _layout.tsx              # Root: QueryClientProvider, auth check, redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── invite/[token].tsx   # Deep link invitation
│   ├── (client)/
│   │   ├── _layout.tsx          # Tab navigator
│   │   ├── index.tsx            # Today screen (Step 13)
│   │   ├── nutrition/
│   │   │   ├── index.tsx        # Weekly menu (Step 15)
│   │   │   ├── [mealId].tsx     # Meal detail (Step 13)
│   │   │   └── shopping.tsx     # Shopping list (Step 15)
│   │   ├── measurements/
│   │   │   ├── index.tsx        # History (Step 16)
│   │   │   └── new.tsx          # New measurement (Step 16)
│   │   └── scanner.tsx          # Barcode scanner (Step 14)
│   └── (trainer)/
│       └── _layout.tsx          # Placeholder for future
├── src/
│   ├── api/client.ts            # Axios instance (mirrors web, uses MMKV for tokens)
│   ├── api/generated.ts         # NSwag output (copy from web or separate generation)
│   ├── stores/auth.ts           # Zustand + MMKV (mirrors web/src/stores/auth.ts)
│   ├── stores/offline.ts        # Offline mutation queue
│   ├── hooks/useNetworkStatus.ts
│   ├── components/              # Shared mobile components
│   └── theme/colors.ts          # Matches web palette
```

**Auth flow:**
- `(auth)/login.tsx` — email/password form, calls `apiClient.loginEndpoint()`
- `(auth)/invite/[token].tsx` — deep link handler for trainer invitations
- Token storage: Zustand + MMKV (not AsyncStorage — MMKV is synchronous, 30x faster)
- Root `_layout.tsx` checks auth on mount, redirects accordingly
- Deep link config in `app.json`: `"scheme": "fitnessplatform"`

**Verify:** `npx expo start`, login flow works on iOS simulator/Android emulator.

---

## Step 13: Mobile — Today Screen + Meal Detail

**Goal:** Client's main screen showing today's meals and macros.

**Files to create:**
- `mobile/src/components/CalorieCircle.tsx` — SVG progress circle with kcal in center
- `mobile/src/components/MacroCard.tsx` — protein/carbs/fat card with progress bar
- `mobile/src/components/MealListCard.tsx` — meal card (name, time, kcal, eaten status)
- `mobile/src/components/OfflineBanner.tsx` — "Offline mode" strip using netinfo
- `mobile/app/(client)/index.tsx` — Today screen: CalorieCircle + 3 MacroCards + meal list
- `mobile/app/(client)/nutrition/[mealId].tsx` — Meal detail: food table, "Mark as eaten" button with optimistic update

**Features:**
- `useQuery(['today-nutrition'])` for data fetching
- Pull-to-refresh via FlatList
- Prefetch today + current week on app launch
- Offline: show cached data from MMKV-persisted query cache + OfflineBanner
- "Mark as eaten": `useMutation` with `onMutate` for optimistic update

**Verify:** App loads today's meals, marking as eaten updates UI instantly.

---

## Step 14: Mobile — Barcode Scanner

**Goal:** Scan EAN codes to look up foods.

**Files to create:**
- `mobile/app/(client)/scanner.tsx` — fullscreen camera with `expo-camera` barcode scanning
- Bottom sheet showing food detail on successful scan

**Behavior:**
- On scan → haptic feedback (expo-haptics) → `GET /foods/barcode/{barcode}`
- Found → show food detail + "Add to meal" button
- Not found → offer manual search or navigate to food search
- Filter for CODE_128 and EAN_13 barcode types

**Verify:** Test on physical device (camera required), scan a real product barcode.

---

## Step 15: Mobile — Weekly Menu + Shopping List

**Files to create:**
- `mobile/app/(client)/nutrition/index.tsx` — 7 day cards (scrollable), each showing date, total kcal, meal count, completion %
- `mobile/app/(client)/nutrition/shopping.tsx` — shopping list grouped by category, checkboxes persisted in MMKV
- Share button using expo-sharing

**Verify:** Weekly view shows correct days, shopping list aggregates correctly, checkbox state persists.

---

## Step 16: Mobile — Body Measurements + Offline

**Files to create:**
- `mobile/app/(client)/measurements/index.tsx` — weight history chart (Victory Native line chart), measurement list
- `mobile/app/(client)/measurements/new.tsx` — form with big +/- weight buttons, 5 measurement inputs, 4 photo slots (expo-image-picker), multipart upload
- `mobile/src/stores/offline.ts` — mutation queue: stores pending mutations in MMKV, processes on reconnect
- `mobile/src/hooks/useOfflineMutations.ts` — hook that queues mutations when offline, syncs when online

**Offline configuration:**
- TanStack Query: `staleTime: 5min` (nutrition), `gcTime: 7 days`, `networkMode: 'offlineFirst'`
- Persist query cache to MMKV via `persistQueryClient`
- Meal-eaten mutations must work offline (queue + sync)
- Weekly measurement notification via `expo-notifications`

**Verify:** Turn off network, app shows cached data with banner, queue a meal-eaten, turn on network, mutation syncs.

---

## Key Architecture Decisions

1. **MongoDB documents are standalone POCOs** — they do NOT inherit from EF base entities. `Guid ExternalId` serves as the API-facing ID.
2. **Denormalized food data in meal plans** — food name + nutrients are snapshotted when added to a meal. Historical accuracy even if food is later updated.
3. **Optimistic locking** via `Version` field on NutritionPlan (409 Conflict on mismatch).
4. **MealLog in separate MongoDB collection** — grows unboundedly, queried by date range.
5. **Shopping list aggregation in C#** — plan is already loaded in memory, simpler than MongoDB aggregation pipeline.
6. **Web plan editor uses Zustand local store** — instant UI for frequent micro-edits, debounced auto-save. TanStack Query for initial fetch only.
7. **Mobile uses MMKV** (not AsyncStorage) — synchronous reads for auth tokens, 30x faster, required for TanStack Query persister.
8. **No shared package between web and mobile** — duplicate small amounts (types, schemas). Avoids monorepo tooling overhead.
9. **Cross-database reads** (PostgreSQL for auth checks, MongoDB for data) — no distributed transactions needed since auth is read-only.

## Packages to Add

**Backend test project:** `Testcontainers.MongoDb`

**Web:** `@tanstack/react-table`

**Mobile (new project):** `@tanstack/react-query`, `@tanstack/query-sync-storage-persister`, `@tanstack/react-query-persist-client`, `zustand`, `react-native-mmkv`, `axios`, `@react-native-community/netinfo`, `expo-camera`, `expo-image-picker`, `expo-haptics`, `expo-notifications`, `victory-native`, `react-native-svg`, `zod`, `react-hook-form`, `@hookform/resolvers`
