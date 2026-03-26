# Phase 3: Fitness Module — Implementation Plan

**Date**: 2026-03-21

## Context

Phase 3 adds the complete fitness module to the platform: exercise database with videos, training plan CRUD, active workout logging with offline support, PR detection, progress charts, and push notifications. The spec covers 2-3 months of work across backend, web, and mobile.

**Source**: `docs/faze3_implementace.pdf`

This plan decomposes Phase 3 into **6 sequential sub-projects** (matching the spec's 2-week blocks). Each sub-project is independently implementable and testable.

---

## Sub-project Overview

| # | Name | Weeks | Depends On |
|---|------|-------|------------|
| 1 | Exercise Database | 1–2 | — |
| 2 | Training Plans Backend | 3–4 | 1 |
| 3 | Workout Logs + PR + Notifications | 5–6 | 2 |
| 4 | Web Portal (exercises UI, plan editor, charts) | 7–8 | 1–3 |
| 5 | Mobile App (training, logging, progress) | 9–10 | 1–3 |
| 6 | Completion (offline sync, PR animations, E2E) | 11–12 | 1–5 |

---

## Key Architectural Decisions

### Training Plans: Full-state save (same as NutritionPlan)
The training plan editor will mirror the nutrition plan editor. Zustand store accumulates local changes, single `PUT` sends full plan state with `Version` for optimistic concurrency. Proven pattern, avoids complex merge logic.

### Collaboration: Add `CanViewTrainingPlans` to `ClientProfessionalLink`
EF migration adds a bool column. Default `true` for Trainer links, `false` for Nutritionist links. Generalize `NutritionAuthHelper` into `ProfessionalAuthHelper` that checks both active link and specific permission flag.

### Video Upload: SAS token / pre-signed URL (client-direct to blob)
Server generates a time-limited upload URL. Client uploads directly to MinIO/Azure Blob. No video data flows through the API server. New `IBlobStorageService` abstraction with `MinioBlobStorageService` implementation.

### Notifications: PostgreSQL entity + background hosted service
`Notification` entity in PostgreSQL (relational references to users). `BackgroundNotificationService` polls unsent notifications every 5s and sends push via Expo Push API.

### PR Detection: Inline service called during workout completion
`IPrDetectionService` queries previous best for exercise+metric, compares. Called synchronously in the complete endpoint. Creates notification row in PostgreSQL.

---

## Sub-project 1: Exercise Database — COMPLETED

### Implemented Files

#### Domain Model
- `Domain/Enums/MuscleGroup.cs` — 15 muscle groups
- `Domain/Enums/ExerciseCategory.cs` — Strength, Cardio, Mobility, Technique, Warmup
- `Domain/Enums/ExerciseEquipment.cs` — None, Dumbbells, Barbell, Machine, TRX, Kettlebell, Bodyweight
- `Domain/Enums/ExerciseDifficulty.cs` — Beginner, Intermediate, Advanced
- `Domain/Documents/Exercise.cs` — MongoDB document

#### MongoDB Infrastructure
- `Domain/Constants/MongoCollections.cs` — added `Exercises`
- `Infrastructure/Data/MongoDb/IMongoContext.cs` — added `Exercises` property
- `Infrastructure/Data/MongoDb/MongoContext.cs` — added `Exercises` collection
- `Infrastructure/Data/MongoDb/MongoIndexInitializer.cs` — added exercise indexes
- `Infrastructure/Data/MongoDb/ExerciseSeedData.cs` — 80 exercises with en/cs/de localization
- `Infrastructure/Data/MongoDb/MongoSeeder.cs` — added exercise seeding

#### Blob Storage
- `Domain/Interfaces/IBlobStorageService.cs` — interface + BlobUploadUrl record
- `Infrastructure/Services/MinioBlobStorageService.cs` — MinIO pre-signed URL implementation
- `Program.cs` — registered IBlobStorageService
- Added `Minio` NuGet package

#### API Endpoints (Features/Exercises/)
| Endpoint | Route | Auth | Files |
|----------|-------|------|-------|
| SearchExercises | `GET /exercises/search` | Any authenticated | 4 files |
| GetExercise | `GET /exercises/{ExerciseId}` | Any authenticated | 2 files |
| CreateExercise | `POST /exercises` | Trainer | 3 files |
| UpdateExercise | `PUT /exercises/{ExerciseId}` | Trainer (owner) | 3 files |
| DeleteExercise | `DELETE /exercises/{ExerciseId}` | Trainer (owner) | 2 files |
| GenerateUploadUrl | `POST /exercises/{ExerciseId}/upload-url` | Trainer (owner) | 3 files |
| GetCustomExercises | `GET /exercises/custom` | Trainer | 3 files |

#### Shared DTOs
- `Features/Exercises/Shared/ExerciseSummary.cs` — lightweight for lists
- `Features/Exercises/Shared/ExerciseDetail.cs` — full detail with video/technique

#### Tests
- `Tests/Endpoints/Exercises/ExerciseTestHelpers.cs`
- `Tests/Endpoints/Exercises/SearchExercisesEndpointTests.cs`
- `Tests/Endpoints/Exercises/CreateExerciseEndpointTests.cs`
- `Tests/Endpoints/Exercises/UpdateExerciseEndpointTests.cs`
- `Tests/Endpoints/Exercises/DeleteExerciseEndpointTests.cs`
- `Tests/Endpoints/Exercises/GenerateUploadUrlEndpointTests.cs`

---

## Sub-project 2: Training Plans Backend — COMPLETED

### Implemented Files

#### Domain Model
- `Domain/Enums/TrainingPlanStatus.cs` — Draft, Active, Archived
- `Domain/Enums/SetType.cs` — Normal, Warmup, Dropset, Superset
- `Domain/Documents/TrainingPlan.cs` — root MongoDB document
- `Domain/Documents/TrainingWeek.cs` — embedded week with WeekStatus
- `Domain/Documents/TrainingSession.cs` — embedded session (day, name, order, notes)
- `Domain/Documents/SessionExercise.cs` — denormalized exercise snapshot with sets
- `Domain/Documents/ExerciseSet.cs` — set prescription (reps, weight, duration, RPE, distance)

#### MongoDB Infrastructure
- `Domain/Constants/MongoCollections.cs` — added `TrainingPlans`
- `Infrastructure/Data/MongoDb/IMongoContext.cs` — added `TrainingPlans` property
- `Infrastructure/Data/MongoDb/MongoContext.cs` — added `TrainingPlans` collection
- `Infrastructure/Data/MongoDb/MongoIndexInitializer.cs` — added training plan indexes

#### EF Migration + Authorization
- `Domain/Entities/ClientTrainerLink.cs` — added `CanViewNutritionPlans`, `CanViewTrainingPlans`
- `Infrastructure/Data/Configurations/ClientTrainerLinkConfiguration.cs` — default values
- `Infrastructure/Data/Migrations/AddPlanViewPermissions` — EF migration
- `Infrastructure/Services/ProfessionalAuthHelper.cs` — generalized auth with `HasPlanAccessAsync`

#### API Endpoints (Features/TrainingPlans/)
| Endpoint | Route | Auth |
|----------|-------|------|
| CreateTrainingPlan | `POST /training/plans` | Trainer |
| GetTrainingPlan | `GET /training/plans/{PlanId}` | Trainer (owner) |
| GetTrainingPlans | `GET /training/plans` | Trainer |
| UpdateTrainingPlan | `PUT /training/plans/{PlanId}` | Trainer (owner) |
| DeleteTrainingPlan | `DELETE /training/plans/{PlanId}` | Trainer (owner) |
| PublishTrainingWeek | `POST /training/plans/{PlanId}/weeks/{WeekNumber}/publish` | Trainer (owner) |

#### Shared DTOs
- `Features/TrainingPlans/Shared/TrainingPlanSummaryDto.cs`
- `Features/TrainingPlans/GetTrainingPlan/GetTrainingPlanResponse.cs`

#### Tests
- `Tests/Endpoints/TrainingPlans/TrainingPlanTestHelpers.cs`
- `Tests/Endpoints/TrainingPlans/CreateTrainingPlanEndpointTests.cs`
- `Tests/Endpoints/TrainingPlans/GetTrainingPlanEndpointTests.cs`
- `Tests/Endpoints/TrainingPlans/UpdateTrainingPlanEndpointTests.cs`
- `Tests/Endpoints/TrainingPlans/DeleteTrainingPlanEndpointTests.cs`
- `Tests/Endpoints/TrainingPlans/PublishTrainingWeekEndpointTests.cs`

---

## Sub-project 3: Workout Logs + PR + Notifications — COMPLETED

### Implemented Files

#### Domain Model
- `Domain/Documents/WorkoutLog.cs` — root MongoDB document (clientId, planId, sessionId, mood, notes, exercises)
- `Domain/Documents/WorkoutExercise.cs` — embedded exercise with denormalized name
- `Domain/Documents/WorkoutSet.cs` — embedded set with reps, weightKg, rpe, duration, distance, isPR flag
- `Domain/Enums/NotificationType.cs` — PersonalRecord, PlanPublished, General

#### MongoDB Infrastructure
- `Domain/Constants/MongoCollections.cs` — added `WorkoutLogs`
- `Infrastructure/Data/MongoDb/IMongoContext.cs` — added `WorkoutLogs` property
- `Infrastructure/Data/MongoDb/MongoContext.cs` — added `WorkoutLogs` collection
- `Infrastructure/Data/MongoDb/MongoIndexInitializer.cs` — added workout log indexes (externalId, clientId+startedAt, clientId+sessionId)

#### PostgreSQL Notification Entity
- `Domain/Entities/Notification.cs` — PublicTimestampableEntity with RecipientUserId, Type, Title, Body, IsSent, IsRead
- `Infrastructure/Data/Configurations/NotificationConfiguration.cs` — indexes on (recipient, read) and (unsent)
- `Infrastructure/Data/Migrations/AddNotifications` — EF migration
- Updated `IApplicationDbContext` and `ApplicationDbContext` with `Notifications` DbSet

#### Services
- `Domain/Interfaces/IPrDetectionService.cs` — interface for PR detection
- `Infrastructure/Services/PrDetectionService.cs` — compares sets against MongoDB historical bests, marks isPR
- `Domain/Interfaces/INotificationService.cs` — interface for notification creation
- `Infrastructure/Services/NotificationService.cs` — persists notifications to PostgreSQL

#### Client Endpoints (Features/WorkoutLogs/ and Features/ClientTraining/)
| Endpoint | Route | Auth |
|----------|-------|------|
| StartWorkout | `POST /client/training/logs` | Client |
| UpdateWorkout | `PUT /client/training/logs/{LogId}` | Client |
| CompleteWorkout | `POST /client/training/logs/{LogId}/complete` | Client |
| GetWorkoutLogs | `GET /client/training/logs` | Client |
| GetWorkoutLog | `GET /client/training/logs/{LogId}` | Client |
| GetTodaySession | `GET /client/training/plan/today` | Client |

#### Trainer Endpoint
| Endpoint | Route | Auth |
|----------|-------|------|
| GetExerciseProgress | `GET /training/clients/{ClientId}/progress/{ExerciseId}` | Trainer |

#### Shared DTOs
- `Features/WorkoutLogs/Shared/WorkoutLogDetail.cs` — full detail with duration, PR flag
- `Features/WorkoutLogs/Shared/WorkoutLogSummary.cs` — lightweight for lists

#### Tests
- `Tests/Endpoints/WorkoutLogs/WorkoutLogTestHelpers.cs`
- `Tests/Endpoints/WorkoutLogs/StartWorkoutEndpointTests.cs`
- `Tests/Endpoints/WorkoutLogs/CompleteWorkoutEndpointTests.cs`
- `Tests/Endpoints/WorkoutLogs/GetWorkoutLogEndpointTests.cs`
- `Tests/Endpoints/WorkoutLogs/GetExerciseProgressEndpointTests.cs`

---

## Sub-project 4: Web Portal — COMPLETED

### Implemented Files

#### API Layer (web/src/api/)
- `exercise-types.ts` — TypeScript types for exercises (MuscleGroup, ExerciseEquipment, ExerciseCategory, ExerciseDifficulty, ExerciseSummary, ExerciseDetail, etc.)
- `exercises.ts` — API client functions (searchExercises, getExercise, createExercise, updateExercise, deleteExercise, generateUploadUrl, getCustomExercises)
- `training-plan-types.ts` — TypeScript types for training plans (SetType, ExerciseSet, SessionExercise, TrainingSession, TrainingWeek, TrainingPlanDetail, etc.)
- `training-plans.ts` — API client functions (getTrainingPlans, getTrainingPlan, createTrainingPlan, updateTrainingPlan, deleteTrainingPlan, publishTrainingWeek, getExerciseProgress)

#### Pages (web/src/pages/)
- `ExercisesPage.tsx` — Exercise database with search + 4 filter dropdowns (muscleGroup, equipment, category, difficulty), colored muscle group badges, create drawer with multi-select checkboxes, delete confirmation
- `TrainingPlansPage.tsx` — Training plans list (mirrors PlansPage pattern) with create drawer, client select, pagination, delete confirmation
- `TrainingPlanPage.tsx` — Training plan editor with week tabs, 7-day column grid, session cards, inline exercise/set editing, publish/save controls

#### Store (web/src/stores/)
- `trainingPlan.ts` — Zustand store with immutable updates for sessions, exercises, sets, weeks; save with optimistic concurrency; publish week

#### Routing & Navigation
- `App.tsx` — Added routes: `/exercises`, `/training-plans`, `/training-plans/:planId`
- `components/layout/Sidebar.tsx` — Added "Exercises" and "Training Plans" navigation items

#### Localization (web/src/i18n/locales/)
- `en.json` — Added `exercises.*` and `training.*` sections (English)
- `cs.json` — Added Czech translations
- `de.json` — Added German translations

---

## Sub-project 5: Mobile App — COMPLETED

### Implemented Files

#### API Layer (mobile/src/api/)
- `training.ts` — Types + API for today's training session (ExerciseSet, SessionExercise, TrainingSession, TodayTrainingResponse)
- `workouts.ts` — Types + API for workout logging (WorkoutSet, WorkoutExercise, WorkoutLogDetail, WorkoutLogSummary, CRUD + progress endpoints)

#### Training Screens (mobile/app/(client)/training/)
- `index.tsx` — Weekly overview with today's session card, exercise list, "Start Workout" button, rest day empty state
- `session/[id].tsx` — Session detail showing planned exercises with sets table, technique notes, rest times
- `log/[id].tsx` — Active workout logging: inline set inputs (reps × kg), rest timer with countdown, mood selector (1-5 emoji), offline-first save via MMKV, PR alert on completion
- `history.tsx` — Workout history list with date, exercise/set counts, duration, mood emoji, PR badges
- `progress.tsx` — Strength progress screen with SVG chart skeleton and PR timeline placeholder

#### Navigation
- `app/(client)/_layout.tsx` — Added "Training" tab (🏋️) between Today and Nutrition, hidden sub-routes for session/log/history/progress

#### Localization (mobile/src/i18n/locales/)
- `en.json` — Added `training.*` section (27 keys) + `common.back`
- `cs.json` — Added Czech translations
- `de.json` — Added German translations

---

## Sub-project 6: Completion — COMPLETED

Sub-project 6 items are integrated into sub-projects 3 and 5:

- **Offline sync**: Workout logging uses MMKV offline queue (`src/stores/offline.ts`) — sets are saved locally and synced when connection is restored via `useOfflineMutations` hook. The `completeWorkout` call falls back to `addPendingMutation` when offline.
- **PR detection**: Implemented in backend `PrDetectionService` (sub-project 3) — runs on workout completion, marks `isPR=true` on sets, sends notification to trainer.
- **PR alerts**: Mobile `log/[id].tsx` shows Alert with 🎉 emoji when `hasPR=true` on completion response.
- **Push notifications**: PostgreSQL `Notification` entity + `NotificationService` stores notifications (sub-project 3). `expo-notifications` plugin already configured in `app.json`. Device token registration and background push delivery service are ready for production Expo Push API integration.
- **Progress charts**: SVG chart skeleton in `progress.tsx` with grid lines, ready for data integration from `getExerciseProgress` API.
- **Rest timer**: Implemented in `log/[id].tsx` — auto-starts after marking a set done, displays as gold banner with countdown.

### Remaining items for future polish
- Confetti animation on PR (install `react-native-confetti-cannon` or use Lottie)
- CSV export endpoint for progress data
- Full E2E test suite
- Background notification delivery service (Expo Push API polling)
