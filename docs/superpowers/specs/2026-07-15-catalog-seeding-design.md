# Public catalog seeding — design spec

**Date:** 2026-07-15
**Status:** Approved (user, 2026-07-15)
**Scope:** `/backend` only. No web/mobile changes. No new endpoints/UI.

## Goal

`dotnet run -- --seed` produces a complete public content catalog:

1. A fixed-GUID **admin system user** (PostgreSQL) that owns seeded content where an owner is structurally required.
2. **Foods** — expanded public catalog covering every ingredient used by the imported recipes.
3. **Recipes** — ~127 real recipes imported from the user's Notion "Receptář" database, public, admin-owned.
4. **Exercises** — catalog expanded to cover all categories/muscle groups.
5. **Workout templates** — new public `workoutTemplates` collection with ≥2 templates per `WorkoutFormat`.

## 1. Admin system user

- New constants class `Domain/Constants/SystemUsers.cs`: `public static readonly Guid AdminId = Guid.Parse("aa000000-0000-0000-0000-000000000001")` + `AdminEmail = "system@goodfellas.local"`. (Distinct from the `11111111…`/`22222222…` QA fixture GUID family.)
- `ApplicationDbContextSeed.SeedAsync` gains `EnsureSystemAdminAsync(UserManager<ApplicationUser>)` after role seeding:
  - Find by fixed Id; if missing, create with `EmailConfirmed = true`, `IsActive = true`, `FirstName = "GoodFellas"`, `LastName = "System"`, cryptographically random password (never logged/revealed) → **non-loginable** attribution account.
  - Add to `Admin` role (idempotent).
- Runs in both `--seed` and `--qa-seed` (both call `ApplicationDbContextSeed.SeedAsync`).

## 2. Ownership semantics (deliberately non-uniform)

| Entity | Owner field | Seeded value | Why |
|---|---|---|---|
| Recipe | `NutritionistId` (required) | `SystemUsers.AdminId` | Schema requires an owner; admin = system catalog. `Visibility = Public`. |
| WorkoutTemplate | `OwnerId` | `SystemUsers.AdminId` | New doc; consistent attribution. |
| Food | `NutritionistId?` | `null` | `/foods/custom` filters by owner; stamping admin would misclassify catalog as "custom". Null-owner is the existing system convention. `Visibility = Public`. |
| Exercise | `TrainerId?` | `null` | Same reasoning (`/exercises/custom`); `IsCustom = false`, `Source = "system"`. |

The existing per-nutritionist private recipe cloning in `MongoSeeder` is **removed** (recipes no longer gated on a nutritionist existing, no longer Private, no longer duplicated per user).

## 3. Seed data as embedded JSON resources

Notion-derived bulk data is checked in as **embedded JSON resources** (not inline C#) under
`FitnessPlatform.Application/Seed/Data/`:

- `seed-foods.json` — full food catalog additions: slug, localized names (cs/en/de), `FoodCategory`, per-100g `NutrientValue`, allergens, common servings.
- `seed-recipes.json` — recipes: slug, name (cs; en/de left null — source content is Czech), description, prep minutes, steps[], meal types, servings, ingredients as `{ foodSlug, grams, note?, optional? }`, stated per-portion kcal (for validation only).
- `seed-workout-templates.json` — templates: slug, localized names, description, difficulty, duration, format, format config, sections → exercises referenced by **exercise slug** with sets/reps/rest prescriptions.

Loader pattern: `JsonSerializer.Deserialize` from `Assembly.GetManifestResourceStream` (`<EmbeddedResource>` in csproj). Existing C#-builder logic is kept for what it's good at: resolving slug references to seeded documents, denormalizing `MealFood` snapshots, computing `TotalNutrients`.

Existing `FoodSeedData`/`ExerciseSeedData` inline C# entries migrate into the JSON resources (single source of truth; `RecipeSeedData`'s old fixed set is superseded by the Notion import). Exercise catalog additions to cover every `ExerciseCategory` and muscle group live in the same JSON.

### Deterministic IDs

Every seeded document's `ExternalId` derives from its slug: UUIDv5-style `MD5/SHA1(namespace-guid + "food:kureci-prso")` → stable across runs/machines. This is what makes per-document idempotency and cross-references (recipe→food, template→exercise) work.

## 4. Recipe import (one-time extraction, done during this task)

- All 136 pages of the Notion data source fetched; ~9 empty placeholders skipped; near-duplicate pairs (e.g. "Avokádo talíř" / "Avokádo talíř (1)" breakfast-vs-dinner variants) merged into one recipe carrying both meal types.
- Ingredient lines normalized: explicit grams kept; piece/spoon amounts converted with standard weights (vejce ≈ 55 g, lžíce oleje ≈ 10 g, "velká cibule" ≈ 150 g, …).
- Multi-variant recipes (e.g. "s tortillou" vs "s rýží") import the **first** variant; the alternative goes into `Note`.
- Optional/garnish ingredients marked `optional` import with amount but excluded from nothing — they count into totals; purely "to taste" seasonings (sůl, pepř) are dropped.
- **Validation gate:** computed per-portion kcal (from ingredient foods) must be within **±15 %** of the Notion-stated kcal where stated; outliers get amounts re-estimated before the data is accepted.
- Notion meal-type tag (breakfast/lunch/dinner/dessert) lands in a new **additive optional** `Recipe.MealTypes` (`List<string>?`) field — no UI work in this task; absent on legacy docs (nullable, no backfill needed, no Version/CAS concern since Recipe has no Version field).

## 5. WorkoutTemplate — new root aggregate

New document `Domain/Documents/WorkoutTemplate.cs` (scaffold via `mongo-document` skill conventions: ObjectId `Id`, Guid `ExternalId`, `Version` int = 1, audit dates):

```
Id, ExternalId, Version, DateCreated, DateUpdated?
OwnerId        Guid            — SystemUsers.AdminId for seeded content
Name           string
LocalizedNames LocalizedNames? — cs/en/de
Description    string?
Difficulty     ExerciseDifficulty
EstimatedDurationMinutes int?
Format         WorkoutFormat
FormatConfig   WodConfig?
Sections       List<TrainingSection>   — REUSED embedded docs (TrainingSection/SessionExercise/ExerciseSet)
Visibility     WorkoutTemplateVisibility (new enum, { Public = 0, Private = 1 }, same pattern as RecipeVisibility) — seeded Public
```

- Collection `"workoutTemplates"` in `MongoCollections`, registered in `MongoContext` + `IMongoContext`.
- Reusing `TrainingSection` means a template can later be copied verbatim into a client `TrainingPlan` — that's the point.
- **No endpoints, no UI** in this task; browsing/`copy-to-plan` is a follow-up issue.
- Seeder: ≥2 templates per `WorkoutFormat` enum value, exercises referenced by deterministic exercise `ExternalId` + denormalized name, realistic set/rep/rest prescriptions.

## 6. MongoSeeder idempotency rework

Current: whole-collection `CountDocumentsAsync(Empty) > 0` → skip. This would skip all new data on any pre-seeded DB.

New: per-document insert-if-missing, per collection:
1. Load existing `ExternalId`s + normalized `Name`s into hash sets (one query each).
2. Insert only documents whose ExternalId **and** normalized name are absent (name check protects legacy dev DBs whose seed docs have random ExternalIds from getting duplicates).
3. Order: foods → recipes (need food lookup) → exercises → workout templates (need exercise lookup). Postgres phase (roles + admin user) always runs first.

Re-running `--seed` is safely additive. QA fixture data (`QaSeedRunner`, fixed `11111111…` GUIDs) is unaffected and coexists.

## 7. Verification

- Testcontainers test class (backend test conventions, full-suite-safe per project rules):
  - Seed twice → document counts identical (idempotency).
  - Every recipe `MealFood.FoodExternalId` resolves to a seeded Food; every template `SessionExercise.ExerciseExternalId` resolves to a seeded Exercise.
  - Every recipe: `TotalNutrients.Kcal > 0`, `Visibility = Public`, `NutritionistId = SystemUsers.AdminId`.
  - Admin user exists, has Admin role, `EmailConfirmed`.
  - SearchFoods/SearchRecipes filters return seeded content for an arbitrary authenticated user.
- Data-prep validation (pre-checkin, scripted): ±15 % kcal check against Notion-stated values; all ingredient slugs resolve; all template exercise slugs resolve.
- Full surface: `dotnet build` + full feature/seed test namespaces (not a filtered slice).

## Out of scope (follow-ups)

- Workout-template browse/copy endpoints + web/mobile UI.
- Admin tooling to edit the system catalog (admin user is non-loginable until then).
- en/de translations of recipe names/steps (source content is Czech; `LocalizedNames` fields exist where models support them).
