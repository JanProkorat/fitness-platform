# Reusable Content Libraries — Backend Design

- **Status:** Approved for issue creation — 2026-08-02
- **Scope:** Backend only. Web/mobile UI is deliberately excluded; the FE
  prototype is pending and will be built against the contract this spec settles.
- **Related:** `docs/architecture/ADR-0001-plan-data-model.md` (Tier 2c legacy
  cleanup, canonical `ClientId`), issue #766 (ownership/copy-to-own for
  Foods/Recipes), issue #847 (drop legacy collections), #824 (template library),
  #809 (public catalog seed).

---

## 1. Goal

Four coach-facing asks, all variations on "let me save this and reuse it":

1. **Nutritionist** — save a composed meal (foods + recipes) for reuse, with a
   dedicated database page alongside Foods and Recipes.
2. **Nutritionist** — save a nutrition plan as a template and start a new
   client's plan from it. Clients differ in detail but cluster by goal and
   dietary limitation; a template plus small edits saves most of the work.
3. **Coach** — save a training session for reuse across plans and days, with a
   dedicated database page.
4. **Coach** — save a training plan as a template, same rationale as (2).

Two of these turned out to be blocked on data-model problems that have to be
fixed first. Sections 2 and 3 cover those; sections 4–6 cover the features.

---

## 2. Vocabulary correction: section → workout

The product renamed "section" to "workout" long ago, but only on the frontend.
The backend still says section, and the mismatch has produced a name collision
that blocks feature 3.

| Coach says | Backend today | Backend after |
|---|---|---|
| **Workout** — a block inside a session (warm-up, main lift, AMRAP finisher) | `TrainingSection` | `TrainingWorkout` |
| — its reusable template | `SectionTemplate` | `WorkoutTemplate` |
| **Session** — one training bout; a day may hold several (morning + evening) | `TrainingSession` | unchanged |
| — its reusable template | `WorkoutTemplate` *(misnamed — it holds `Sections[]`)* | `SessionTemplate` |

Feature 3's entity therefore already exists as a document: the thing currently
called `WorkoutTemplate` **is** a session template. It has seeded public catalog
data from #809 and a read-only surface on `GET /training/section-templates`, but
no trainer CRUD. The blocker is that its correct name is occupied by the wrong
document.

The two collection renames are a **swap** and must be ordered:

```
1. renameCollection  workoutTemplates → sessionTemplates
2. renameCollection  sectionTemplates → workoutTemplates
```

Reversed, step 2 fails on an existing target.

**Rename depth: full.** C# types and feature folders, API routes and DTO field
names, and MongoDB element and collection names. Two known casualties, both
acceptable *because* the clients are mid-redesign and regenerate their API
clients — and both are the reason this lands before the new FE, not after:

- `ErrorCodes.TrainingSectionNotFound` is documented as a stable frontend
  localization key. It becomes `TrainingWorkoutNotFound`.
- `POST|DELETE /client/training/sessions/{id}/sections/{id}/complete` is live in
  mobile. It becomes `.../workouts/{id}/complete`.

---

## 3. Training plan tree: the missing day level

The nutrition tree has an explicit day; the training tree does not.

```
NutritionPlan                     TrainingPlan (today)
 └ weeks[]  PlanWeek               └ weeks[]  TrainingWeek
    └ days[]   PlanDay                └ sessions[]  TrainingSession
       └ meals[]  PlanMeal                              (carries its own dayOfWeek)
                                      + dayNotes: Dictionary<int, string>
```

`TrainingWeek.DayNotes` is a `Dictionary<int, string>` keyed by day-of-week,
stored with a custom `[BsonDictionaryOptions(ArrayOfDocuments)]` representation.
It is a day entity in disguise — someone needed day-level data, had nowhere to
put it, and added a side-map. `CreatePlanEndpoint.cs:144` already materialises
all 7 `PlanDay`s per nutrition week; training gets the same treatment.

### Target tree

```
TrainingPlan
 └ weeks[]        TrainingWeek      { WeekNumber, Status, DatePublished, Days[7] }
    └ days[]         TrainingDay    { DayOfWeek, Note?, Sessions[] }
       └ sessions[]     TrainingSession
          ├ exercises[]    SessionExercise     ← standalone (section 4)
          └ workouts[]     TrainingWorkout
               └ exercises[]  SessionExercise
                    └ sets[]     ExerciseSet
```

- `TrainingDay` — 7 materialised per week. A rest day is a day with no
  sessions, representable for the first time.
- `TrainingWeek.DayNotes` folds into `TrainingDay.Note` and is removed.
- `TrainingSession` **drops** `DayOfWeek`; the parent day owns it. Keeping both
  is a guaranteed desync. `Order` stays, for morning-vs-evening ordering within
  the day.

The actuals collections are untouched by this restructure: `SessionExecution`
keys on `(clientId, planId, sessionId, date)` and `SessionLock` on `sessionId`.
Neither traverses the week tree.

---

## 4. Standalone exercises in a session

A `PlanMeal` holds `foods[]` and `recipes[]` side by side. A session should
likewise hold exercises directly, not only inside a workout wrapper:

```
TrainingSession
   ├ exercises[]  SessionExercise      ← new: stored, standalone
   └ workouts[]   TrainingWorkout
```

**Ordering interleaves.** Unlike `MealFood`/`MealRecipe`, which have no `Order`
field, both `SessionExercise` and `TrainingWorkout` already carry one. Training
order is meaningful (warm-up → main block → finisher), so standalone exercises
and workouts share a single ordering sequence within the session. A validator
rejects duplicate order values across the two lists.

### 4.1 Blocker: the #837 boot backfill must be deleted first

`MongoIndexInitializer.cs:1085` matches any document with
`weeks.sessions.exercises` and wraps that flat list into a synthesized "Hlavní"
section. Shipping a first-class `exercises` field under that means **every
backend boot silently swallows every standalone exercise into a workout** — no
error, the coach's plan quietly restructured.

The backfill has already completed its job. ADR-0001 Tier 2c and issue #847 both
call for deleting these legacy branches. Removing it (and its `workoutLogs`
sibling at `MongoIndexInitializer.cs:1164`) is a hard prerequisite of this work,
not opportunistic cleanup.

### 4.2 Blocker: `SessionExercise` has no instance identity

Exercise completion is keyed by `(SectionId, ExerciseExternalId)` —
`MarkExerciseCompleteEndpoint.cs:113-121`. `SessionExercise` has no id of its
own, unlike `TrainingWorkout.WorkoutId` or `PlanMeal.MealId`. Consequences:

- The same catalog exercise programmed twice in one workout is **already**
  indistinguishable for completion today.
- Standalone exercises have no parent workout to key under, and "bench press as
  a standalone warm-up plus bench press in the main block" is ordinary
  programming.

**Fix:** `SessionExercise` gains `ExerciseId` (a `Guid` instance id, mirroring
`WorkoutId` / `MealId`). Completion keys on it alone:

| `SessionExecution` field | Before | After |
|---|---|---|
| `completedExerciseIds` | flat list of `ExerciseExternalId`, deprecated | **removed** |
| `completedExerciseIdsBySection` | `Dictionary<sectionId, [externalId]>` | **removed** |
| `completedExerciseInstanceIds` | — | **new** — flat `List<Guid>` of `SessionExercise.ExerciseId` |
| `completedSectionIds` | `List<Guid>` | renamed `completedWorkoutIds`, values unchanged |
| `completedSets` | `Dictionary<externalId, [setNo]>` | rekeyed on `ExerciseId` |

The new field takes a **new name** (`completedExerciseInstanceIds`) rather than
reusing `completedExerciseIds`, because the old field holds different semantics
(catalog ids, not instance ids) and a silent semantic swap under an unchanged
name is exactly the class of bug this section exists to remove.

The by-workout dictionary disappears entirely — a net simplification of the
mark/unmark endpoints, `ComplianceService`, and the `SessionExecution` read
paths.

---

## 5. The four libraries

### 5.1 Entities

All five template documents (four new, one renamed) share a shape: `ObjectId Id`,
`Guid ExternalId`, `Guid OwnerId`, `Name`, `LibraryVisibility Visibility`,
`DateCreated` / `DateUpdated`, `int Version`.

| Level | Document | Collection | Status |
|---|---|---|---|
| Workout | `WorkoutTemplate` *(was `SectionTemplate`)* | `workoutTemplates` | CRUD exists → rename only |
| Session | `SessionTemplate` *(was `WorkoutTemplate`)* | `sessionTemplates` | doc + seeds exist → **new CRUD** |
| Meal | `MealTemplate` | `mealTemplates` | **new** |
| Nutrition plan | `NutritionPlanTemplate` | `nutritionPlanTemplates` | **new** |
| Training plan | `TrainingPlanTemplate` | `trainingPlanTemplates` | **new** |

**`MealTemplate`** — owner (nutritionist), name, `description?`, `MealKind?`
hint, `List<MealFood>`, `List<MealRecipe>` (existing snapshot shapes, verbatim),
server-computed `NutrientTotals`. Library sorts on calories.

**`NutritionPlanTemplate`** — owner, name, `description?`, `PrimaryGoal?`,
`DietaryStyle?`, `GlobalNutritionSettings?`, `List<Supplement>`,
`List<TemplateWeek>`, denormalized `WeekCount`.

**`TrainingPlanTemplate`** — owner, name, `description?`, `PrimaryGoal?`,
`ExerciseDifficulty?`, `List<TrainingTemplateWeek>`, denormalized `WeekCount`.

Nutrition templates carry `DietaryStyle` where training templates carry
`Difficulty`: difficulty is meaningless for a meal plan, and "vegan / keto /
low-FODMAP" is the real filter for the *similar limitations* use case.

`SessionTemplate` needs no structural change beyond the rename — it already has
owner, name, `LocalizedNames`, description, difficulty,
`EstimatedDurationMinutes`, format, `FormatConfig`, workouts, visibility, audit
fields and `Version`. It gains standalone `Exercises` for parity with
`TrainingSession` (section 4) — that addition belongs to #860, which owns
`SessionTemplate`'s content; #857 only renames it.

The renamed workout-level `WorkoutTemplate` is otherwise **untouched** — no
visibility field, no new columns. Adding sharing to it is not in scope.

### 5.2 Template week types

Templates get slim week types, because `PlanWeek` and `TrainingWeek` carry
`Status` and `DatePublished`, which are meaningless outside a client plan:

```csharp
TemplateWeek         { int WeekNumber; List<PlanDay>     Days; }
TrainingTemplateWeek { int WeekNumber; List<TrainingDay> Days; }
```

Everything below the week — `PlanDay`, `PlanMeal`, `MealFood`, `MealRecipe`,
`TrainingDay`, `TrainingSession`, `TrainingWorkout`, `SessionExercise` — is
reused unchanged, so copying in either direction is a straight clone. Client-only
fields (`ClientId`, `Status`, `StartDate`, publish/complete dates,
`QuestionnaireResponseId`, `TargetWeightKg`) are absent from templates by
construction rather than nulled out.

### 5.3 Sharing model

```csharp
public enum LibraryVisibility { Private = 0, Public = 1 }   // stored as string
```

`Private = 0` means both the CLR default and any field-absent legacy document
deserialize to Private — correct for the ex-`SectionTemplate` documents, which
were owner-only before. Because visibility is stored as a **string**
(`"Public"` / `"Private"`), the seeded public session-template catalog keeps
deserializing correctly despite the numeric order differing from the old
`WorkoutTemplateVisibility`.

Rules, identical across all libraries:

- **Read** — your own entries at any visibility, plus everyone's `Public` ones.
- **Write / delete** — owner only, regardless of visibility → `403` with a
  stable `*_NOT_OWNED` error code.
- **Copy-to-own** — `POST .../{id}/copy` clones any readable entry to the caller
  as `Private` with a fresh `ExternalId`. This is how a coach adapts someone
  else's public template.
- **Concurrency** — document-level `Version` CAS on update, `409` on mismatch,
  same shape as `PlanConcurrencyGuard`.

This adopts issue #766's target model from birth. Foods and Recipes are **not**
retrofitted here; that stays #766's job.

### 5.4 Endpoints

| | Meal templates | Session templates | Nutrition plan templates | Training plan templates |
|---|---|---|---|---|
| base | `/nutrition/meal-templates` | `/training/session-templates` | `/nutrition/plan-templates` | `/training/plan-templates` |
| role | Nutritionist | Trainer | Nutritionist | Trainer |
| search | `GET` — name, page/pageSize, `X-Total-Count` | + difficulty, duration | + goal, dietary style, week count | + goal, difficulty, week count |
| detail | `GET /{id}` | ✔ | ✔ | ✔ |
| CRUD | `POST` · `PUT /{id}` · `DELETE /{id}` | ✔ | ✔ | ✔ |
| copy | `POST /{id}/copy` | ✔ | ✔ | ✔ |
| save from plan | `POST /from-plan` `{planId, week, day, mealId, …}` | `POST /from-plan` `{planId, week, day, sessionId, …}` | `POST /from-plan` `{planId, …}` | `POST /from-plan` `{planId, …}` |
| instantiate | — | — | `POST /{id}/instantiate` | `POST /{id}/instantiate` |

30 endpoints. Search returns own entries at any visibility plus others' public
ones, matching `SearchRecipesEndpoint.cs:50-53`.

**`instantiate`** takes `{ clientId, name, startDate? }`, verifies the
coach↔client link, and writes a new **Draft** plan with every week Draft — a
verbatim copy plus those three fields. No week-count juggling, no macro
rescaling; the coach adjusts in the plan editor they already know.

**The reverse direction needs no endpoint.** Dropping a meal or session template
*into* an open plan is done by the client: `GET` the template, include it in the
existing full-document `UpdatePlan` write. This deliberately keeps the whole
feature off the plan write path, the riskiest code in the backend.

---

## 6. Migration

One boot migration, streamed via cursor + `BulkWrite` per #848's pattern.
Human-merged per `rules/merge-strategy.md#exclusion-list`.

1. `renameCollection workoutTemplates → sessionTemplates`.
2. `renameCollection sectionTemplates → workoutTemplates`.
3. **`trainingPlans`** — per document, per week: group `sessions[]` by
   `dayOfWeek` into a materialised `days[1..7]`; move `week.dayNotes[d]` to
   `day.note`; unset `week.dayNotes`; drop `session.dayOfWeek`; rename
   `session.sections` → `session.workouts` and `workout.sectionId` →
   `workout.workoutId`; assign a fresh `exerciseId` to every `SessionExercise`
   (standalone and nested).
4. **`sessionExecutions`** — rename `completedSectionIds` →
   `completedWorkoutIds` (values unchanged). Resolve
   `completedExerciseIdsBySection[sectionId] = [externalId]` against the parent
   plan's session to find each matching `SessionExercise` instance, and write
   its new `exerciseId` into `completedExerciseInstanceIds`. Rekey
   `completedSets` the same way. Drop the two old fields.
5. **`workoutLogs` / `sessionExecutions.performance`** — rename `sections` →
   `workouts`, `sectionId` → `workoutId`.
6. **Delete** the #837 legacy-`exercises` backfill at
   `MongoIndexInitializer.cs:1085` and its `workoutLogs` sibling at `:1164`.

Step 4 is the only lossy-if-wrong step: a completion record that fails to
resolve leaves a past session looking incomplete and skews compliance. It needs
explicit Testcontainers coverage for the resolve path, including the
duplicate-exercise case that motivated `ExerciseId` in the first place.

---

## 7. Issue breakdown

Epic **#856**, six children. All backend-only.

| Issue | Title | Type | Depends on |
|---|---|---|---|
| **#857** | Training plan tree restructure — `TrainingDay`, standalone exercises, `SessionExercise.ExerciseId`, section→workout rename (code + API + Mongo) | `refactor` | — |
| **#858** | Library foundation — `LibraryVisibility`, ownership guard, error codes, search/pagination helper | `feature` | — |
| **#859** | `MealTemplate` — CRUD, search, from-plan, copy | `feature` | #858 |
| **#860** | `SessionTemplate` — CRUD, search, from-plan, copy | `feature` | #857, #858 |
| **#861** | `NutritionPlanTemplate` — CRUD, search, from-plan, instantiate, copy | `feature` | #858 |
| **#862** | `TrainingPlanTemplate` — CRUD, search, from-plan, instantiate, copy | `feature` | #857, #858 |

#857 is the largest and riskiest, and carries the only data migration.
Sections 2, 3 and 4 of this spec all rewrite the same field paths in the same
documents and touch a near-identical set of ~15 training endpoints and their
tests; splitting them would mean multiple full passes over every training plan,
multiple human-merged migrations, and each rebasing onto the previous one's
churn. They land as one issue with internal commits as resume points:

1. Mechanical rename (tests stay green throughout).
2. `TrainingDay` level.
3. Standalone exercises + `SessionExercise.ExerciseId`, with the #837 backfill
   deleted **before** the new `exercises` field is introduced.

#859 and #861 (nutrition side) do not depend on #857 and start immediately in
parallel with it.

---

## 8. Out of scope

Deliberately excluded, each worth its own issue later:

- All web and mobile UI, including the four database pages.
- Seeding public plan templates into the #809 catalog.
- Retrofitting the sharing model onto Foods and Recipes (#766).
- Adding visibility/sharing to the workout-level `WorkoutTemplate`.
- Week-count adjustment or macro rescaling at instantiate time.
- ADR-0001 Tier 3 (per-week split, immutable published-week snapshots). Plan
  templates do **not** depend on it.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| #837 backfill swallows standalone exercises on boot | Delete it before introducing the field; assert absence in a test |
| Completion-record resolve (migration step 4) loses history | Testcontainers coverage incl. duplicate-exercise case; verify compliance figures before/after on seeded data |
| #857 blocks two of four features | Nutrition children (#859, #861) run in parallel and are independent |
| Route + error-code renames break live clients | Both clients are mid-redesign and regenerate; land before the new FE |
| Collection-rename ordering | Swap is ordered explicitly in §6; the reverse order fails loudly, not silently |
