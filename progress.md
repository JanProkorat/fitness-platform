# Implementation Progress

Comparison of the technical documentation (`docs/technicka_dokumentace.pdf`)
against the actual codebase state as of 2026-04-09.

---

## Tech Stack: Doc vs Reality

| Layer | Documentation says | Actual | Status |
|---|---|---|---|
| Backend | ASP.NET Core 9 | ASP.NET Core 10 (.NET 10) | Upgraded |
| API framework | (implicit REST) | FastEndpoints 8.0.1 | Evolved |
| Relational DB | PostgreSQL | PostgreSQL (EF Core 10) | Match |
| Document DB | MongoDB | MongoDB (Driver 3.7) | Match |
| Blob storage | Azure Blob Storage | MinIO (S3-compatible) | Changed |
| Real-time | SignalR (ASP.NET) | SignalR (@microsoft/signalr) | Match |
| Web portal | React 18 + shadcn/ui | React 19 + custom Tailwind | Upgraded, no shadcn |
| Web charts | Recharts | Not installed | Not implemented |
| Web build | (Vite implied) | Vite 7.3 | Match |
| Mobile framework | React Native + Expo SDK 52 | React Native 0.83 + Expo SDK 55 | Upgraded |
| Mobile routing | Expo Router | Expo Router v55 | Match |
| Mobile state | TanStack Query + Zustand | TanStack Query 5 + Zustand 5 | Match |
| Mobile storage | React Native MMKV | MMKV 4.2 | Match |
| Mobile camera | Expo Camera / BarCodeScanner | expo-camera (installed) | Partial |
| Mobile charts | Victory Native | Not installed | Not implemented |
| Mobile video | Expo AV | Not installed | Not implemented |
| CI/CD | GitHub Actions | Not configured | Not implemented |

---

## Data Model: Doc vs Reality

### PostgreSQL Tables

| Table (doc) | Implemented | Notes |
|---|---|---|
| Users | Yes | ApplicationUser via ASP.NET Identity |
| Roles | Yes | ApplicationRole via Identity |
| UserRoles | Yes | Identity M:N junction table |
| TrainerProfiles | Yes | ProfessionalProfile entity |
| ClientProfiles | Yes | With ActivityLevel, GoalType, etc. |
| ClientTrainerLinks | Yes | Status, InviteToken, StartDate, EndDate |
| TrainerCollaborations | Yes | Trainer-Nutritionist shared clients |
| BodyMeasurements | Yes | WeightKg, BodyFatPct, WaistCm, etc. |
| ProgressPhotos | Yes | PhotoUrl, PhotoType (Front/Side/Back) |
| — | Yes (extra) | Questionnaire, QuestionnaireQuestion, QuestionnaireResponse, QuestionnaireAnswer |
| — | Yes (extra) | Conversation, ChatMessage |
| — | Yes (extra) | Notification, DevicePushToken |
| — | Yes (extra) | PendingInvite, InvitationToken, EmailVerificationToken |
| — | Yes (extra) | ClientRequest, ClientOnboardingData |
| — | Yes (extra) | AuditLog (GDPR compliance) |

### MongoDB Collections

| Collection (doc) | Implemented | Notes |
|---|---|---|
| nutrition_plans | Yes | Full hierarchy: weeks > days > meals > foods |
| training_plans | Yes | weeks > sessions > exercises > sets |
| workout_logs | Yes | Exercise-level tracking with RPE, PR detection |
| foods | Yes | OpenFoodFacts cache + custom foods |
| exercises | Yes (extra) | Localized names, equipment, muscle groups |
| recipes | Yes (extra) | With food ingredients and variants |
| meal_logs | Yes (extra) | Daily meal consumption tracking |

---

## API Endpoints: Doc vs Reality

### Auth & Users (doc: 11 endpoints)

| Endpoint | Doc | Implemented | Notes |
|---|---|---|---|
| POST /auth/register | Yes | Yes | |
| POST /auth/login | Yes | Yes | |
| POST /auth/refresh | Yes | Yes | |
| POST /auth/logout | Yes | Yes | |
| POST /auth/invite/accept | Yes | Yes | Token-based email invite |
| POST /auth/password/reset | Yes | Yes | |
| PUT /auth/password/reset/{token} | Yes | Yes | |
| GET /users/me | Yes | Yes | |
| PUT /users/me | Yes | Yes | |
| GET /trainer/clients | Yes | Yes | |
| POST /trainer/clients/invite | Yes | Yes | |
| POST /trainer/collaborations | Yes | Yes | |
| — | — | Yes (extra) | POST /auth/verify-email, GET /auth/verify-email/{token} |
| — | — | Yes (extra) | POST /client/push-token |

### Nutrition Plans (doc: 12 endpoints)

| Endpoint | Doc | Implemented | Notes |
|---|---|---|---|
| GET /nutrition/plans | Yes | Yes | |
| POST /nutrition/plans | Yes | Yes | |
| GET /nutrition/plans/{planId} | Yes | Yes | |
| PUT /nutrition/plans/{planId} | Yes | Yes | Full-state update with versioning |
| POST /nutrition/plans/{planId}/publish | Yes | Yes | Per-week publish |
| POST /nutrition/plans/{planId}/duplicate | Yes | Yes | |
| PUT /nutrition/.../weeks/{w}/days/{d} | Yes | Yes | |
| POST /nutrition/.../days/{d}/meals | Yes | Yes | |
| POST /nutrition/.../meals/{mId}/foods | Yes | Yes | |
| GET /client/nutrition/plan/today | Yes | Yes | |
| GET /client/nutrition/plan/shopping-list | Yes | Yes | |
| GET /nutrition/clients/{clientId}/progress | Yes | Yes | Compliance endpoint |
| — | — | Yes (extra) | GET /client/nutrition/plan/full, GET /client/nutrition/plan/week |
| — | — | Yes (extra) | POST /client/nutrition/log/meals/{mealId}/eaten |
| — | — | Yes (extra) | GET /client/progress/weekly, GET /client/progress/compliance |

### Training Plans (doc: 14 endpoints)

| Endpoint | Doc | Implemented | Notes |
|---|---|---|---|
| GET /training/plans | Yes | Yes | |
| POST /training/plans | Yes | Yes | |
| POST /training/plans/{planId}/publish | Yes | Yes | Per-week publish |
| POST /training/plans/{planId}/duplicate | Yes | Yes | |
| POST /training/.../weeks/{w}/sessions | Yes | Yes | |
| POST /training/.../sessions/{sId}/exercises | Yes | Yes | |
| PUT /training/.../exercises/reorder | Yes | Yes | |
| GET /client/training/plan/today | Yes | Yes | |
| POST /client/training/logs | Yes | Yes | Start workout |
| PUT /client/training/logs/{logId} | Yes | Yes | Update sets |
| POST /client/training/logs/{logId}/complete | Yes | Yes | |
| GET /client/training/logs | Yes | Yes | History |
| GET /training/clients/{clientId}/progress/{exerciseId} | Yes | Yes | |
| — | — | Yes (extra) | PUT /training/plans/{planId} (full-state update) |

### Foods, Exercises & Measurements (doc: 10 endpoints)

| Endpoint | Doc | Implemented | Notes |
|---|---|---|---|
| GET /foods/search | Yes | Yes | Full-text + category filter |
| GET /foods/barcode/{barcode} | Yes | Yes | OpenFoodFacts lookup |
| POST /foods | Yes | Yes | Custom food creation |
| GET /exercises/search | Yes | Yes | Muscle + equipment filter |
| POST /exercises | Yes | Yes | Custom exercise creation |
| POST /exercises/{id}/video | Yes | Yes | Video upload (MinIO) |
| POST /client/measurements | Yes | Yes | |
| GET /client/measurements | Yes | Yes | |
| POST /client/photos | Yes | Yes | Progress photo upload |
| GET /trainer/clients/{clientId}/dashboard | Yes | Yes | |
| — | — | Yes (extra) | GET /client/measurements/stats |
| — | — | Yes (extra) | Recipes CRUD (5 endpoints) |

### Not in doc but implemented

| Feature | Endpoints | Notes |
|---|---|---|
| Messaging | 8 endpoints | Conversations, messages, archive/unarchive, read status |
| Questionnaires | 12 endpoints | Template CRUD, assignment, client responses, status tracking |
| Client requests | 3 endpoints | Join request flow (alternative to invite) |
| Notifications | 4 endpoints | List, mark read, mark all read |
| Professional search | 2 endpoints | Public trainer/nutritionist discovery |
| Collaborations | 3 endpoints | Client-side collaboration management |

---

## Feature Implementation Status

### Backend (116 endpoints)

| Feature | Status | Endpoints | Notes |
|---|---|---|---|
| Authentication | Done | 9 | JWT, refresh tokens, email verification, invites |
| User management | Done | 4 | Profile CRUD |
| Trainer management | Done | 17 | Client list, dashboard, progress, collaborations |
| Nutrition plans | Done | 7 | Full CRUD + per-week publish + versioning |
| Training plans | Done | 6 | Full CRUD + per-week publish |
| Client nutrition | Done | 6 | Today's plan, meal logging, compliance |
| Client training | Done | 1 | Today's session |
| Workout logging | Done | 6 | Start/update/complete, PR detection |
| Measurements | Done | 5 | Body measurements + stats |
| Questionnaires | Done | 12 | Templates, assignment, responses |
| Messaging | Done | 8 | Chat, archive, read status |
| Exercises DB | Done | 7 | Search, CRUD, video upload, localization |
| Foods DB | Done | 6 | Search, barcode, CRUD, OpenFoodFacts |
| Recipes | Done | 5 | CRUD with food ingredients |
| Notifications | Done | 4 | In-app + push (Expo) |
| Client invites/requests | Done | 3+3 | Email invite + join request flows |
| Professional search | Done | 2 | Public profiles, search |
| SignalR events | Done | 11 | All real-time events wired |

### Web Portal

| Feature | Status | Notes |
|---|---|---|
| Auth (login, register, password reset) | Done | Token refresh, email verification |
| Dashboard | Done | Client overview |
| Client management | Done | List, detail, nutrition/training views |
| Nutrition plan editor | Done | Week/day/meal structure, food search, DnD, macro sliders |
| Training plan editor | Done | DnD sessions/exercises across weeks, @dnd-kit |
| Exercise database | Done | Search, CRUD, localized names |
| Food database | Done | Search, CRUD, barcode lookup |
| Recipe management | Done | CRUD with ingredients |
| Questionnaire editor | Done | Template builder, preview, assignment |
| Messaging | Done | Conversations, chat UI |
| Notifications | Done | Bell + notification list |
| Role-based routing | Done | Trainer / Nutritionist / Admin guards |
| i18n (cs, en, de) | Done | Full translation coverage |
| Dark mode | Done | Toggle in UI |
| Charts / analytics | Not started | Recharts mentioned in doc but not installed |
| Tests | Not started | No test infrastructure |

### Mobile App

| Feature | Status | Notes |
|---|---|---|
| Auth (login, register, verify email) | Done | Token refresh, session restore |
| Today screen (3 states) | Done | no-trainer, plan-pending, has-trainer |
| Trainer discovery | Done | Search, filters, profile view, send invite |
| Plans overview | Done | List + detail view |
| Nutrition tracking | Done | Today's meals, macro bars, mark eaten, shopping list |
| Training tracking | Done | Today's session, exercise list, workout logging |
| Measurements | Done | Add new, history view |
| Profile | Done | Settings, theme, collaborations |
| Messaging | Done | Conversations, chat, typing indicator, archive |
| Questionnaire | Done | Multi-step onboarding form |
| Notifications | Done | Sheet, mark read, SignalR-driven |
| Invites / requests | Done | Accept/decline, invite redemption |
| SignalR real-time | Done | All events, no polling |
| i18n (cs, en, de) | Done | Full coverage |
| Offline support | Partial | MMKV persistence, offline mutation queue exists |
| Barcode scanning | Not started | expo-camera installed but no scanning UI |
| Exercise videos | Not started | Expo AV not installed |
| Progress charts | Not started | Victory Native not installed |
| Push notifications | Partial | Token registration done, deep link on tap done |

---

## Recent Changes (2026-04-09): Questionnaire Multi-Coach Rework

**Problem**: Questionnaire responses were not properly scoped per coach — Coach A
could see Coach B's answers, and profile mapping overwrote global client data on
each submission. Client endpoint assumed a single professional.

**Changes made**:

- **Privacy fix**: `GetClientResponseEndpoint` now filters by `ProfessionalId`,
  ensuring each coach only sees responses from their own questionnaires.
- **Profile mapping removed**: `ProfileMapperService` no longer writes answers to
  `ClientProfile`/`ClientOnboardingData`. Coaches read answers directly from
  `QuestionnaireResponse`. Shared profile fields (height, weight, etc.) should be
  updated by the client via the measurements screen.
- **Multi-coach client endpoint**: `GET /client/questionnaire` now accepts an
  optional `?linkPublicId=` query param to select which coach's questionnaire to
  load (legacy fallback preserved).
- **New endpoint**: `GET /client/questionnaires/pending` returns all pending
  questionnaires across all active professional links.
- **New endpoint**: `GET /trainer/clients/{id}/questionnaire-responses` (plural)
  returns full response history scoped to the requesting professional.
- **Web component**: `QuestionnaireAnswersSection` reworked to use the plural
  endpoint, shows accordion-based response history, and includes a "Send
  questionnaire" button even when submitted responses exist.
- **i18n**: Added `previousResponses`, `statusPending`, `statusInProgress`,
  `submitted` keys in en/cs/de.

**Mobile profile rework** (same session):
- **New endpoint**: `GET /client/questionnaires/submitted` returns all submitted
  questionnaire responses grouped by professional link (coach).
- **Profile screen**: Removed standalone "Anamnéza" (QuestionnaireSection) that
  showed a single global questionnaire. Replaced the old "Active Collaborations"
  section with a new "Coaches" section. Each coach card shows name/role/city,
  message and end-collaboration buttons, and all submitted questionnaire responses
  for that coach (collapsible, with "show all / show less").
- **Mobile API**: Added `getSubmittedQuestionnairesByCoach()` in
  `src/api/questionnaire.ts`.
- **i18n**: Added `coaches`, `noCoaches`, `questionnaires`, `noQuestionnaires`,
  `submittedAt` keys in en/cs/de.

**Not yet done** (next phases):
- Mobile: rework `(auth)/questionnaire.tsx` to enumerate pending questionnaires
  from all coaches (currently shows first link only).
- Mobile: move questionnaire flow into `(client)/` tab so it's accessible after
  onboarding, not just during auth.

---

## Plan-Questionnaire Linking Feature (designed 2026-04-09)

**Implementation plan document**: `docs/plan-questionnaire-implementation-plan.docx`

**Goal**: Connect questionnaire responses to specific plans (nutrition/training),
support plan completion lifecycle, and enable coaches to create new plans with
new questionnaires for the same client.

**4-phase implementation plan**:

1. **Phase 1 — Plan Completion** (backend): Add `Completed` status to
   NutritionPlan/TrainingPlan MongoDB documents. New endpoints:
   `POST /nutrition/plans/{planId}/complete` and
   `POST /training/plans/{planId}/complete`. Status flow:
   Draft → Active → Completed (or Archived).

2. **Phase 2 — Plan-Questionnaire Link** (backend): Add optional
   `QuestionnaireResponseId` (Guid?) field to NutritionPlan and TrainingPlan
   MongoDB documents. New endpoint:
   `PUT /nutrition|training/plans/{planId}/link-questionnaire`. Cross-DB
   reference validation (PostgreSQL response → MongoDB plan).

3. **Phase 3 — Web Portal**: Plan creation wizard with questionnaire link
   selector. Answers preview panel on plan detail. Plan completion button with
   confirmation dialog.

4. **Phase 4 — Mobile App**: Plan history screen showing completed plans.
   Questionnaire link display on plan detail. Plan completion status indicators.

**Phase 1 implemented (2026-04-09)**:

- Added `Completed` enum value to `NutritionPlanStatus` and `TrainingPlanStatus`
  (between Active and Archived). Status flow: Draft → Active → Completed (or Archived).
- Added `DateCompleted` (DateTime?, BsonIgnoreIfNull) to `NutritionPlan` and
  `TrainingPlan` MongoDB documents.
- Added `DateCompleted` to `GetPlanResponse` and `GetTrainingPlanResponse` DTOs
  (mapped in `FromDocument`).
- Added `PlanNotActive` error code to `ErrorCodes.cs`.
- New endpoint: `POST /nutrition/plans/{planId}/complete` — marks active nutrition
  plan as completed. Validates ownership (NutritionistId), version (optimistic
  concurrency), and Active status. Notifies client via notification + SignalR
  (`nutritionPlanCompleted` event).
- New endpoint: `POST /training/plans/{planId}/complete` — same for training plans
  (Trainer role, `trainingPlanCompleted` event).
- i18n: Added `statusCompleted`, `completePlan`, `confirmComplete`, `planCompleted`
  keys in web (en/cs/de) for both nutrition and training namespaces. Added
  `completed`, `nutritionPlanCompleted`, `trainingPlanCompleted` (+ body variants)
  in mobile (en/cs/de).

**Phase 2 implemented (2026-04-09)**:

- Added `QuestionnaireResponseId` (Guid?, BsonIgnoreIfNull) to `NutritionPlan` and
  `TrainingPlan` MongoDB documents. Cross-DB reference to PostgreSQL
  `QuestionnaireResponse.PublicId`.
- Added `QuestionnaireResponseId` to `GetPlanResponse`, `GetTrainingPlanResponse`,
  `PlanSummaryDto`, `TrainingPlanSummaryDto` DTOs (mapped in `FromDocument`).
- Added optional `QuestionnaireResponseId` to `CreatePlanRequest` and
  `CreateTrainingPlanRequest`. Create endpoints validate the response exists,
  belongs to the same professional + client, and has status `Submitted`.
- New endpoint: `PUT /nutrition/plans/{planId}/link-questionnaire` — links or
  unlinks a questionnaire response to a nutrition plan. Validates ownership,
  version, status (only Draft/Active), and cross-DB response existence.
- New endpoint: `PUT /training/plans/{planId}/link-questionnaire` — same for
  training plans.
- i18n: Added `linkedQuestionnaire`, `linkQuestionnaire`, `unlinkQuestionnaire`,
  `selectQuestionnaire`, `noSubmittedResponses`, `questionnaireLinked`,
  `questionnaireUnlinked`, `viewAnswers` keys in web (en/cs/de) for both
  nutrition and training namespaces.

**Phase 3 implemented (2026-04-09)**:

- Updated TypeScript types: `NutritionPlanDetail`, `TrainingPlanDetail`,
  `PlanSummary`, `TrainingPlanSummary` — added `dateCompleted`,
  `questionnaireResponseId`, `'Completed'` to status unions.
  `CreatePlanRequest`/`CreateTrainingPlanRequest` — added optional
  `questionnaireResponseId`.
- Added API functions: `completePlan`, `completeTrainingPlan`,
  `linkQuestionnaire`, `linkTrainingQuestionnaire`, `publishTrainingWeek`,
  `getExerciseProgress` in `plans.ts` and `training-plans.ts`.
- `PlansPage.tsx`: Added `Completed` status style (gold accent). Added
  `QuestionnaireResponseSelect` dropdown in the plan creation drawer so
  trainers can link a submitted questionnaire response when creating a plan.
- `NutritionPlanPage.tsx`: Added "Complete plan" button (visible only when
  status is Active, disabled when unsaved changes). Confirmation dialog with
  gold accent styling. Added `PlanQuestionnairePanel` in the right sidebar
  showing linked questionnaire with expandable answers and link/unlink controls.
- `TrainingPlanPage.tsx`: Same completion button + confirmation dialog. Same
  `PlanQuestionnairePanel` in the right sidebar.
- New reusable components:
  - `QuestionnaireResponseSelect` — dropdown listing submitted responses for
    a client, used in plan creation drawers.
  - `PlanQuestionnairePanel` — sidebar panel showing linked questionnaire,
    expandable answers, link/unlink buttons. Supports both nutrition and
    training namespaces via `ns` prop.

**Phase 4 — Mobile Prototype** (in progress):
- Reworked `docs/mobile_prototype.html` navigation: replaced flat button bar
  with collapsible category groups (Hlavní, Plány & Dotazníky, Spolupráce,
  Zprávy, Stav) using `.pnav-group`/`.pnav-cat`/`.pnav-items` CSS + JS toggle.
- Added 3 new prototype screens:
  - **Archiv plánů** (`ph-plan-history`) — completed plans with gold badges and stats.
  - **Dokončený plán** (`ph-plan-detail-complete`) — plan detail with linked
    questionnaire answers (collapsible).
  - **Čekající dotazníky** (`ph-pending-questionnaires`) — multi-coach pending
    questionnaire enumeration with per-coach cards.
- Added questionnaire banner on Today screen: "📋 2 dotazníky čekají na
  vyplnění" with tap → pending questionnaires screen.
**Phase 4 — Mobile Code** (implemented):

- **API layer** (`src/api/questionnaire.ts`):
  - New `PendingQuestionnaireItem`, `PendingQuestionnairesResponse` types
  - New `getPendingQuestionnaires()` calling `GET /client/questionnaires/pending`
- **API layer** (`src/api/nutrition.ts`):
  - Added `PlanStatus` type (`Draft | Active | Completed | Archived`)
  - Extended `FullPlanResponse` with `status?`, `questionnaireResponseId?`, `dateCompleted?`
  - New `ClientPlanSummary`, `ClientPlansResponse` types and `getClientPlans()` API
- **API layer** (`src/api/training.ts`):
  - Extended `TodayTrainingResponse` with `status?`, `questionnaireResponseId?`, `dateCompleted?`
- **New screen** (`app/(client)/pending-questionnaires.tsx`):
  - Lists pending questionnaires grouped by coach with avatar, role, questionnaire title, count
  - In-progress status chip, fill/continue CTA
  - Empty state when all questionnaires are done
- **Reworked `QuestionnaireBanner`** (`src/components/notifications/QuestionnaireBanner.tsx`):
  - New `count`, `coachNames` props for multi-coach display
  - Single questionnaire: shows "Fill in" button (as before)
  - Multiple: shows "N questionnaires waiting" with chevron → navigates to list
- **Updated `HasTrainerState`** (`src/components/today/HasTrainerState.tsx`):
  - Replaced `hasPendingQuestionnaire` boolean with `useQuery(['pending-questionnaires'])`
  - Banner shows count + coach names, routes to list screen when >1
- **Updated `plans.tsx`** — Plan cards:
  - Status badges on Training/Nutrition plan cards (Active/Completed)
  - Completed plans show green progress bar at 100%, completion date
  - Week strip hidden for completed plans
  - Archive tab fetches `getClientPlans('Completed')` and renders `CompletedPlanCard`s
    with type badge, completion date, and linked questionnaire chip
- **Updated `plans/[planId].tsx`** — Plan detail:
  - New `LinkedQuestionnaireSection` component showing linked questionnaire with
    expandable answers (fetched from submitted responses API)
  - Status badge on training plan info card
  - `formatAnswer()` helper for rendering different answer types
- **Badge component** (`src/components/ui/Badge.tsx`):
  - Added `success` and `muted` variants
- **i18n**: Added `pendingQuestionnaires.*`, `plans.completedOn`, `plans.linkedQuestionnaire`,
  `planDetail.linkedQuestionnaire` keys in en, cs, de
**Web Portal — QuestionnaireAnswersSection rework** (2026-04-10):

- **Replaced full-answers accordion with compact response history table** on client
  detail page (`QuestionnaireAnswersSection.tsx`). The old component displayed
  expandable accordions with full Q&A pairs — now shows a table with columns:
  Questionnaire title, Status (badge), Submitted date, and Linked plan (clickable
  link navigating to the plan detail page).
- **Linked plan resolution**: Fetches both nutrition and training plans for the client,
  builds a `responsePublicId → plan` map, and shows plan name with type emoji
  (🥗 nutrition / 🏋️ training) as a clickable link.
- **Preserved**: Pending questionnaire banner (with revoke/replace actions), "Send
  questionnaire" button, all existing dialog flows (assign, revoke, replace).
- **Removed**: `ResponseAccordion` sub-component, `formatAnswerValue` helper (full
  answers are now only shown on plan detail via `PlanQuestionnairePanel`).
- **i18n**: Added `responseHistory`, `colTitle`, `colStatus`, `colDate`,
  `colLinkedPlan`, `answers` keys in en/cs/de.

**Questionnaire send flow moved to plan sidebar** (2026-04-10):

- **PlanQuestionnairePanel**: Removed `onLink` prop and the link-existing-response
  selector. When no questionnaire is linked, the sidebar now shows a "Send
  questionnaire" button that opens a dialog to select and send a questionnaire
  template to the client (using `assignQuestionnaire` API). When a pending
  questionnaire exists, shows a waiting indicator. When linked, shows answers
  as before.
- **QuestionnaireAnswersSection** (client detail): Now a purely read-only response
  history table. Removed all interactive features: send questionnaire button,
  pending banner, revoke/replace buttons and dialogs. Props simplified to just
  `clientId`. All questionnaire management is now done from plan sidebars.
- **NutritionPlanPage / TrainingPlanPage**: Removed `onLink` prop and
  `linkQuestionnaire`/`linkTrainingQuestionnaire` imports (no longer needed).
- **Sidebar scrollbar fix**: Added `scrollbar-gutter: stable` to both plan page
  sidebars to prevent content shifting when expanding/collapsing questionnaire
  answers.
- **Unlink removed**: Removed the unlink (✕) button from plan sidebar — once
  linked, questionnaires stay connected to their plan.
- **PlanQuestionnairePanel pending state**: Now shows the questionnaire title in
  the waiting indicator, plus Replace and Revoke buttons (moved from client
  detail). Replace opens the questionnaire select dialog, Revoke shows
  confirmation dialog. Both use existing `replaceQuestionnaire` and
  `cancelQuestionnaire` APIs.

**Invite banner fix** (2026-04-10):

- **Fixed**: Invitation card (InviteCard) on the Today screen was only shown when
  `todayState` was `'no-trainer'` or `'plan-pending'`. When a client already had
  an active trainer (`'has-trainer'` state) and a second trainer sent an invite,
  the banner was hidden. Removed the state condition so the invite card now
  appears in all states (`app/(client)/index.tsx`).

- **Backend email case-insensitivity**: `GetPendingInviteEndpoint` and
  `CreatePendingInviteEndpoint` now use case-insensitive email comparison
  (`ToLower()`) so invite lookup works even when the trainer enters a
  different casing than what's stored in the Users table.
- **Enriched SignalR payload**: `invitationReceived` event now includes full
  invite data (id, trainerId, trainerName, trainerRole, trainerCity, message)
  instead of just inviteId + trainerName. Mobile handler sets query cache
  directly from the event so the InviteCard appears instantly without needing
  an API round-trip.
- **Mobile invite polling**: `useClientInvite` hook now overrides global
  `staleTime` to `0` (always refetch on mount) and adds a 30-second
  `refetchInterval` as fallback when SignalR misses the `invitationReceived`
  event (e.g. app backgrounded).
- **Robust null handling**: `fetchPendingInvite` now explicitly checks for
  empty/string responses (FastEndpoints sends empty body for null responses),
  and logs fetch errors in dev mode via `console.warn`.
- **Polling overwrite fix**: `refetchInterval` in `useClientInvite` is now
  a function that returns `false` (stop polling) when invite data exists, and
  `30_000` (30s poll) when no data exists. This prevents the API's "not found"
  response from overwriting invite data set via SignalR's `setQueryData`.
- **Backend diagnostic logging**: `GetPendingInviteEndpoint` now logs a
  warning with all unaccepted invites when no match is found, helping
  diagnose email mismatch issues. Uses `NormalizedEmail` for comparison
  and returns 204 No Content (instead of 200 empty body) for the no-invite
  case.

**Questionnaire banner fix** (2026-04-10):

- **Root cause**: The `questionnaireAssigned` and `questionnaireCancelled`
  SignalR event handlers in `app/(client)/_layout.tsx` invalidated
  `['notifications']` but NOT `['pending-questionnaires']`. The
  `HasTrainerState` component uses the `['pending-questionnaires']` query
  to render the `QuestionnaireBanner`. With the global `staleTime: 5min`,
  the stale empty result persisted, so the banner never appeared after
  a questionnaire was assigned in real-time.
- **Fix 1**: Added `queryClient.invalidateQueries({ queryKey:
  ['pending-questionnaires'] })` to both the `questionnaireAssigned` and
  `questionnaireCancelled` event handlers.
- **Fix 2**: Moved `QuestionnaireBanner` from `HasTrainerState` to the Today
  screen (`app/(client)/index.tsx`) so the banner is visible in ALL states
  (no-trainer, plan-pending, has-trainer). Previously, the banner only rendered
  inside `HasTrainerState`, which meant clients in `plan-pending` state
  (plan with a future start date) never saw the questionnaire banner.
- **Fix 3**: Backend `GET /client/questionnaires/pending` now skips links where
  the client already has a `Submitted` response. Previously, submitted responses
  were ignored (only `Pending`/`InProgress` were queried), so if a questionnaire
  existed for the link, it showed up as "pending" even after completion. Also
  handles legacy responses (with `LinkId == 0`) by matching on `ProfessionalId`.
- **Tab bar**: Hidden bottom navigation on `pending-questionnaires` screen
  (added to `hideTabBar` condition in `_layout.tsx`).
- **Active plans — linked questionnaire badge**: Added the "📋 Linked
  Questionnaire" badge (same as archived plans) to both `TrainingPlanCard` and
  `NutritionPlanCard` in `plans.tsx`. Shows when `questionnaireResponseId` exists.
- **Mobile — invalidate pending-questionnaires on submit**: After successful
  questionnaire submission (`questionnaire.tsx`), the `['pending-questionnaires']`
  query is now invalidated immediately so the banner disappears without
  needing a pull-to-refresh.
- **Backend — enriched `questionnaireSubmitted` SignalR payload**: Added
  `ClientId` to the payload sent by `ProfileMapperService` so the web portal
  can invalidate the correct per-client query.
- **Web — `questionnaireSubmitted` handler improvements**: The handler now
  reads the payload (`ClientPublicId`, `ClientName`), shows the client name in
  the toast, and invalidates `['questionnaire-responses', clientPublicId]` and
  `['client-dashboard']` so the `PlanQuestionnairePanel` updates from
  "pending" to "submitted" in real-time. Fixed SignalR payload mismatch —
  previously sent user GUID (`ClientId`) but the web query key uses the
  profile's `PublicId`.
- **Backend — `ProfileMapperService` sends `ClientPublicId`**: Changed from
  sending `ClientId` (user GUID) to `ClientPublicId` (profile PublicId) in the
  `questionnaireSubmitted` SignalR payload, matching what the web uses in query
  keys.
- **Web — `PlanQuestionnairePanel` handles unlinked submitted responses**: When
  the plan doesn't have a `questionnaireResponseId` but the client has submitted
  responses, the panel now falls back to showing the latest submitted response
  with answers. Previously it showed an empty "Send questionnaire" button
  because the linking step (plan ↔ response) is manual and hadn't been done.
- **Backend — `AcceptClientInviteEndpoint` creates `QuestionnaireResponse`**:
  When a client accepts an invitation that includes a questionnaire, the endpoint
  now creates a `QuestionnaireResponse` entity with status `Pending` (matching
  what `AssignQuestionnaireEndpoint` does). Previously it only set
  `QuestionnaireId` on the link but never created a response entity, so the
  web portal's `PlanQuestionnairePanel` couldn't detect the pending state and
  showed "Send questionnaire" instead of "⏳ Waiting for response".
- **Mobile — pass `linkPublicId` to questionnaire screen**: The questionnaire
  screen (`app/(auth)/questionnaire.tsx`) now accepts a `linkPublicId` search
  param and passes it to `GET /client/questionnaire?linkPublicId=...`. Both
  the Today banner (single questionnaire) and the pending-questionnaires list
  now pass the specific `linkPublicId` when navigating. Previously the screen
  always fetched the first active link's questionnaire, which could be from a
  different coach than the one shown on the banner.
- **Layout cleanup** (`app/(client)/_layout.tsx`):
  - Hidden `pending-questionnaires` from tab bar with `href: null` (only accessible via Today banner)
- **Profile cleanup** (`app/(client)/profile.tsx`):
  - Removed questionnaire answers rendering from coach cards (answers now live on plan detail)

**Phase 4 — Backend Extensions** (implemented):

- **Extended `GetFullPlanResponse`** — added `Status`, `QuestionnaireResponseId`,
  `DateCompleted` properties. `GetFullPlanEndpoint` now populates them from the
  NutritionPlan document.
- **Extended `GetTodaySessionResponse`** — added `Status?`, `QuestionnaireResponseId?`,
  `DateCompleted?` properties. `GetTodaySessionEndpoint` now populates them from
  the TrainingPlan document.
- **New endpoint `GET /client/plans`** (`Features/Client/Plans/GetClientPlans/`):
  - Returns combined list of nutrition + training plans for the authenticated client
  - Optional `?status=Completed` filter (also supports Active, Archived)
  - Excludes Draft plans by default
  - Returns `ClientPlanItem` with: planId, planName, type, status, startDate,
    totalWeeks, publishedWeekCount, dateCompleted, questionnaireResponseId
  - Sorted by dateCompleted descending

**Waiting-for-plan state redesign** (2026-04-10):

- **Mobile prototype** (`docs/mobile_prototype.html`): Added 5 new "waiting for
  plan" state variations to the Today screen prototype, accessible via the
  "Čeká na plán" nav section. States: waiting for nutrition only, training only,
  both plans, has training + waiting for nutrition, has nutrition + waiting for
  training. Each shows contextual waiting card, gold status chip, and
  context-specific prep tips.
- **New `WaitingForPlanCard` component** (`src/components/today/WaitingForPlanCard.tsx`):
  Extracted reusable card showing waiting state with emoji (✅ or ⏳), title,
  description, and gold status chip. Accepts `waitingForTraining`,
  `waitingForNutrition`, and `hasExistingPlan` props to render the correct
  contextual message.
- **`HasTrainerState.tsx` redesign**: Replaced the generic "Zatím žádné plány"
  empty card with `WaitingForPlanCard`. Uses `getCollaborations()` to
  determine which professional links exist (Trainer vs Nutritionist) and compares
  against available plan/training data to show the correct waiting message.
  - When client has an active plan (training or nutrition) but is waiting for the
    other: shows ⏳ emoji + specific title ("Tréninkový plán se připravuje" /
    "Výživový plán se připravuje").
  - When client has no plans: shows ✅ "Vše je připraveno" with a message that
    the trainer is preparing plans.
  - All states include the `PrepTipsSection` component with tips tailored to
    what's being waited for.
- **`PlanPendingState.tsx` extended**: Added `WaitingForPlanCard` for cases where
  the client has a pending plan from one professional (e.g. nutrition plan starting
  in future) but is also linked to another professional (e.g. trainer) who hasn't
  published a plan yet. The card appears between the plan banners/meal structure
  and the prep tips. Also updated `PrepTipsSection` to include tips for the
  waiting professional type.
- **i18n**: Added `waitingAllReady`, `waitingTrainingTitle`, `waitingNutritionTitle`,
  `waitingBothDesc`, `waitingTrainingDesc`, `waitingNutritionDesc`,
  `waitingChipBoth`, `waitingChipTraining`, `waitingChipNutrition` keys in
  cs/en/de.

---

## Summary

**Backend**: Fully implemented. 116 endpoints across 18 feature areas. All
documented API endpoints are built plus significant extras (messaging,
questionnaires, notifications, recipes). Test suite exists with 88 test files.

**Web portal**: Fully functional trainer/nutritionist portal. All core features
implemented. Missing: analytics charts, test suite.

**Mobile app**: Client app is feature-complete for core flows. Today screen
with all 3 states (including waiting-for-plan cards), nutrition/training
tracking, messaging, discovery, questionnaires. Plans page redesigned with
gradient hero cards matching mobile prototype (LinearGradient backgrounds,
absolute status tags, plan type labels, trainer name subtitles, compliance
stats). Missing: barcode scanning, exercise videos, progress charts.

**Documentation drift**: The tech doc (v1.0, 2025) describes the original
design. The actual implementation has evolved — .NET 10 (was 9), React 19
(was 18), Expo SDK 55 (was 52), MinIO instead of Azure Blob, no shadcn/ui
(custom Tailwind components instead). The doc should be updated to reflect
these changes and the many features added beyond the original scope.

---

## Update 2026-04-10: Nutrition Plan Detail Prototype Screen

Added a new screen to `docs/mobile_prototype.html`: **Detail výživového plánu**
(`ph-nutrition-plan-detail`).

**Features:**
- Compact header with plan name (centered) and back navigation
- Week stepper: ‹/› arrows with centered "Týden N z 12" label and date range; tapping the label opens a 4×3 grid overlay for quick jump to any week
- Day strip (Po–Ne) with completed/today/future states, clickable
- Daily macro summary card: kcal + protein/carbs/fat/fiber progress bars with targets
- 5 collapsible meal cards (Snídaně, Dopolední svačina, Oběd, Odpolední svačina, Večeře)
  - Each shows meal time, item count, total kcal, and macro breakdown (B/S/T)
  - Expandable to show individual food items with name, description, kcal, and weight
  - Recipe items visually differentiated with a "RECEPT" badge and gold accent
  - Nutritionist tips/notes per meal
- Daily note banner from the nutritionist
- Interactive JS: `npSelectWeek()`, `npSelectDay()`, `npToggleMeal()` functions
- Implementation plan written to `docs/plan-nutrition-detail.md` (5 phases, 12 new components, all API endpoints mapped)
- Navigation: back to Plans screen, clickable from active nutrition plan card on Plans page
- Registered in prototype nav bar under "Plány & Dotazníky" group

## Update 2026-04-11: Nutrition Plan Detail — Mobile Implementation

Implemented the full nutrition plan detail screen (`app/(client)/nutrition/plan-detail.tsx`)
following the 5-phase plan in `docs/plan-nutrition-detail.md`.

**New files:**
- `mobile/app/(client)/nutrition/plan-detail.tsx` — Full screen (~530 lines)
- `mobile/src/constants/mealKinds.ts` — `MealKind` → icon/tint config mapping

**Modified files:**
- `mobile/src/api/nutrition.ts` — Extended types: `MealKind`, `MealRecipe`,
  added `kind`, `recipes`, `note` to `PlanMeal`; `note` to `PlanDay`;
  localized names and extra nutrient fields to `MealFood`
- `mobile/src/constants/colors.ts` — Added macro color tokens (`macroProtein`,
  `macroCarbs`, `macroFat`, `macroFiber`) to both light/dark schemes + `ColorScheme`
- `mobile/src/i18n/locales/cs.json` — Added `nutrition.planDetail.*` keys
  (fiber, dailyOverview, noMeals, noteFrom, tip, recipe, serving, items, mealKind.*)
- `mobile/src/i18n/locales/en.json` — English equivalents
- `mobile/src/i18n/locales/de.json` — German equivalents

**Screen features:**
- Header with back button, week stepper (‹/› arrows + "Týden N z M" label),
  questionnaire and shopping cart icons
- Week grid overlay (4×3 grid for quick week jump, LayoutAnimation)
- Day strip (7 days with selected/today/completed/future visual states)
- Daily macro card using existing `MacroBar` component with plan targets
- Collapsible meal cards with accordion behavior (one open at a time)
- `FoodItemRow` — food name, category tag, computed kcal, grams
- `RecipeItemRow` — recipe name with 📖 icon and gold RECEPT badge
- Meal notes (tip style) and daily notes (gold banner)
- Loading, error, and empty states
- All colors from `useTheme()`, typography from `Type.*`, radius from `Radius.*`
- Data from `useQuery(['nutrition', 'full-plan'])` via `getFullPlan()` API

**TypeScript**: Compiles cleanly (no new errors introduced; 1 pre-existing
error in `training/index.tsx`).

**Pending**: Wire navigation from Plans tab / nutrition index to the new screen.

---

## Nutrition Plan Detail — UI Polish & Features (2026-04-11)

**Navigation & routing:**
- Wired navigation from Plans tab (`plans/index.tsx`) to `/(client)/nutrition/plan-detail`
- Back button uses `router.navigate('/(client)/plans')` for reliable return
- Tab bar hidden on plan-detail screen

**Day picker (fixed):**
- Moved day strip outside ScrollView so it stays visible while content scrolls
- Added hairline bottom border separator (`rgba(0,0,0,0.08)`)

**Day overview card:**
- Simplified to show `0 / target` values (will fill when meal-eaten tracking is implemented)
- Horizontal `MacroBar` layout (label | track | values in single row)
- Macro values in default label color (no per-macro colors on values)

**Day note:**
- Moved above meals (between macro overview and meal cards)
- Golden "Pozn:" label instead of chat emoji icon
- Background: `bg2` base + transparent `goldBg` overlay (matches meal note appearance)

**Meal cards:**
- Stronger shadow/elevation (`shadowOffset: {0, 4}`, `shadowRadius: 12`, `elevation: 6`)
- Hairline bottom separator on header (`StyleSheet.hairlineWidth`, `rgba(0,0,0,0.08)`)
- Colored macro shortcuts in header (protein red, carbs yellow, fat green, fiber blue)
- Added fiber (V) to macro summary line
- Accordion animation using Reanimated (250ms, bezier easing, always-rendered content)
- Multiple meals can be expanded simultaneously (Set-based tracking)
- Expanded state preserved per day when switching days (keyed by `week-day`)

**Food/recipe item rows:**
- Removed food emoji icons from rows (cleaner layout)
- Food subtitle shows translated category label (`t('nutrition.foodCategory.${food.foodCategory}')`)
- Recipe row: removed gold RECEPT badge, shows "Recept" as subtitle (like food category)
- Recipe serving display moved under kcal (matches food grams placement)
- Food/recipe item notes: golden "Pozn:" line below item row when note exists

**Meal notes:**
- Changed label from "Tip:" to "Pozn:" (Czech i18n)

**Real-time updates:**
- Backend `UpdatePlanEndpoint`: sends `nutritionPlanUpdated` SignalR event to client when saving a plan with published weeks
- Mobile `signalr.ts`: registered `nutritionplanupdated` event
- Mobile plan-detail: listens for both `nutritionplanpublished` and `nutritionplanupdated` SignalR events, invalidates query cache
- Reduced `staleTime` from 5 minutes to 30 seconds
- Added `refetchOnWindowFocus: true`

**Swipe gesture:**
- Swipe left/right on content area to switch days
- Uses `react-native-gesture-handler` (Pan gesture) + Reanimated
- Slide-out/slide-in animation (150ms out + 200ms in) with opacity fade
- `GestureHandlerRootView` wrapper (same pattern as messages screens)

**i18n updates (cs/en/de):**
- `fiberShort`: V / Fb / Ba
- `foodCategory`: 13 category translations
- `tip`: changed to "Pozn:" in Czech
- `recipe`: lowercase "Recept" / "Recipe" / "Rezept"

**Prototype updated (`docs/mobile_prototype.html`):**
- Nutrition plan detail screen updated to match all mobile app changes
- Fixed day picker (outside scroll area, with flex layout)
- Day overview: simplified `0 / target` format, "Denní přehled" header
- Daily note: above meals with golden "Pozn:" label, matching goldBg background
- Meal cards: stronger shadow, hairline header separator, colored macro shortcuts with fiber
- Food rows: category labels as subtitles, no emoji icons
- Recipe rows: "Recept" subtitle instead of gold badge
- Food item notes: example note on first food item
- Meal notes: "Pozn:" instead of "Tip:"

---

## Resend Email Integration (2026-04-11)

**Added Resend .NET SDK** as an alternative email provider, switchable via config flag.

**Files changed:**
- `FitnessPlatform.Application.csproj` — added `Resend 0.2.2` NuGet package
- `Domain/Constants/ConfigKeys.cs` — added `Email:Provider` and `Resend:ApiToken` keys
- `Infrastructure/Services/ResendEmailService.cs` — new `IEmailService` implementation using Resend HTTP API, same template loading as `SmtpEmailService`
- `Program.cs` — conditional DI registration based on `Email:Provider` config (`"Smtp"` default → MailHog, `"Resend"` → Resend API)
- `appsettings.json` — added `Email:Provider` field and `Resend:ApiToken` section

**How it works:**
- `Email:Provider = "Smtp"` (default) → uses existing `SmtpEmailService` with MailHog for local dev
- `Email:Provider = "Resend"` → uses `ResendEmailService` with Resend HTTP API; requires `Resend:ApiToken` to be set
- Tests unaffected — they use `FakeEmailService` which implements `IEmailService` directly

---

## Mobile Prototype: Food Detail & Recipe Detail Screens (2026-04-11)

**Added two new prototype screens** to `docs/mobile_prototype.html` for viewing food/recipe details from a nutrition plan.

### Food Detail screen (`ph-food-detail`)
- Hero section with food name, category badge, and serving amount
- Full macro breakdown card (protein, carbs, fat, fiber) with visual bars
- Extended nutrients (sugars, saturated fat, salt)
- Per-100g reference table
- Common servings chips (selectable)
- Allergen tags
- Trainer's note section
- Barcode display

### Recipe Detail screen (`ph-recipe-detail`)
- Hero section with recipe name, serving count, and prep time
- Total macro breakdown card with visual bars
- Ingredients list with color-coded dots, amounts, and per-ingredient calories — each ingredient tappable to navigate to food detail
- Numbered preparation steps
- Trainer's note section
- Description section

### Localization
- Both screens support tri-lingual switching (CS / EN / DE) via language toggle buttons in the header
- All text labels and content translated in a `_fdTranslations` JS object
- Language switch is shared across both screens

### Navigation
- Food items in the Nutrition Plan Detail (Breakfast → "Ovesná kaše s proteinem") now navigate to Food Detail on tap
- Recipe items in the Nutrition Plan Detail (Dinner → "Losos s quinoou") now navigate to Recipe Detail on tap
- Both detail screens have back navigation to the Nutrition Plan Detail
- Nav buttons added under "Plány & Dotazníky" category in the prototype navbar
- Fixed a pre-existing unclosed `<div>` for the nutrition-plan-detail phone-wrap

---

## Session – 2026-04-11: Food Detail & Recipe Detail Screens (Mobile)

Implemented the food detail and recipe detail screens from the prototype specifications, accessible from the nutrition plan detail's food/recipe rows.

### New Files
- `mobile/app/(client)/nutrition/food-detail.tsx` — Food detail screen
  - Hero section: icon, localized food name, category badge, grams
  - Macros card: 2×2 grid with colored bars (protein/carbs/fat/fiber)
  - Extended nutrients: sugar, saturated fat, salt (when available)
  - Per 100g reference table
  - Common servings chips (planned amount + 100g)
  - Trainer note with gold left-border accent
- `mobile/app/(client)/nutrition/recipe-detail.tsx` — Recipe detail screen
  - Hero section: icon, recipe name, "Recept" badge, servings
  - Total macros card: same 2×2 grid as food detail
  - Ingredients section: food categories with colored dots
  - Trainer note with gold left-border accent

### Modified Files
- `mobile/app/(client)/nutrition/plan-detail.tsx`
  - FoodItemRow: now Pressable, navigates to food-detail with serialized food data + mealName
  - RecipeItemRow: now Pressable, navigates to recipe-detail with serialized recipe data + mealName
  - Both rows show chevron-forward indicator
- `mobile/app/(client)/_layout.tsx`
  - Registered `nutrition/food-detail` and `nutrition/recipe-detail` screens (href: null)
  - Tab bar hidden on both detail screens
- `mobile/src/i18n/locales/cs.json` — Added `foodDetail` and `recipeDetail` sections
- `mobile/src/i18n/locales/en.json` — Added `foodDetail` and `recipeDetail` sections
- `mobile/src/i18n/locales/de.json` — Added `foodDetail` and `recipeDetail` sections

### Design Details
- Both screens follow the prototype design (fd-* CSS classes)
- Use theme colors from design tokens (macroProtein, macroCarbs, macroFat, macroFiber)
- Data passed via Expo Router search params (serialized JSON)
- Header shows the parent meal name (e.g. "Snídaně", "Večeře")
- Back navigation returns to plan-detail

---

## 2026-04-13 — Streak counts today + mobile refresh on meal log

### Backend
- `backend/.../Infrastructure/Services/ComplianceService.cs` —
  `CalculateStreakAsync` now starts at **today** instead of yesterday.
  Rules:
  - If no active plan covers that day (date < `DatePublished`) → stop walking.
  - If plan active but 0 meals planned (rest day) → skip, don't break.
  - ≥80% meals logged → +1.
  - <80% on **today** → skip (user may still log more); don't reset.
  - <80% on any past day → break.

### Mobile
- `mobile/src/components/today/HasTrainerState.tsx` — both
  `toggleEatenMutation` and `markAllEatenMutation` now invalidate
  `['compliance-score']` on success, so the streak stat card refreshes
  immediately after the first meal that pushes the day past the 80%
  threshold. `today-log` invalidation intentionally remains off to avoid
  ring/kcal flicker.

---

## 2026-04-13 — Web client detail: streak & compliance cards

- `web/src/pages/ClientDetailPage.tsx`
  - Stats grid now leads with **🔥 Série** (orange when >0, sub "dní v řadě"),
    followed by **Compliance** (tinted green/amber/red via existing
    threshold, sub "za posledních 7 dní"), then **Pokrok váhy**.
  - Removed the duplicate streak/compliance tags from the PageHeader
    subtitle — the stat cards own that information now; only the goal
    tag remains. Dropped the unused `complianceVariant` memo.
  - No backend changes required: `currentStreak` and `compliancePercent`
    were already returned by `GetClientDashboardEndpoint`.

---

## 2026-04-13 — Client activity timeline (web client detail)

### Backend
- New feature `Features/Trainers/GetClientTimeline/` with endpoint
  `GET /trainer/clients/{ClientId}/timeline?limit=` (1..100, default 30).
  Roles: Trainer / Nutritionist. Verifies an active professional link
  against the target client, audits the read, then composes a merged
  timeline on the fly from existing data sources over the last 90 days:
  - MealLogs — aggregated per calendar day (`meal_day`)
  - WorkoutLogs where `IsCompleted` (`workout`)
  - BodyMeasurements (`measurement`)
  - QuestionnaireResponses with `SubmittedAt` set (`questionnaire`)
  - NutritionPlans / TrainingPlans with `DatePublished` set
    (`nutrition_plan_published` / `training_plan_published`)
  - The trainer-client link itself (`linked`)
  Items ordered `OccurredAt` desc, truncated to `limit`.

### Web
- `web/src/api/timeline.ts` — typed client for the new endpoint.
- `web/src/pages/ClientDetailPage.tsx` — replaces the hand-assembled
  3-event timeline (measurement / questionnaire / linked) with a
  `useQuery(['client-timeline', id])` call that feeds `ActivityTimeline`
  directly.

### Notes
- Option A ("composed on read") intentionally chosen over a
  `ClientActivity` event table. No domain writes added; easy to tune.

---

## 2026-04-13 — Real-time streak/compliance updates for trainers (Phase 5)

### Backend
- `LogMealEatenEndpoint` and `UnlogMealEatenEndpoint` now inject
  `IRealtimeNotifier` and, after a successful Mongo write, look up every
  active `ClientProfessionalLink` for the client, join to
  `ProfessionalProfiles` for the professional's `UserId`, and emit a
  `clientcomplianceupdated` SignalR event to each user's group with
  payload `{ ClientId: <ClientProfile.PublicId> }`.
- Unlog only emits when `DeletedCount > 0` so a no-op delete stays silent.
- Both endpoints share the same private helper
  `NotifyLinkedProfessionalsAsync(clientProfileId, clientPublicId, ct)`.
- Fan-out is intentionally to *all* active professionals (trainer +
  nutritionist if both are linked) — confirmed with user.

### Web
- `AppShell.tsx` — added a `clientComplianceUpdated` handler to the
  existing `useSignalR` map (SignalR JS client lowercases, so it matches
  the backend's `clientcomplianceupdated` emit). On receipt, invalidates
  `['client-dashboard', clientId]` and `['client-timeline', clientId]`,
  so the trainer's open client detail page repaints streak, compliance
  and timeline without polling.

### Notes
- No new UI, no value passed over the wire — server remains source of
  truth; event is just a signal to refetch. Same pattern mobile already
  uses on mutation `onSuccess`, now triggered on the web side by
  SignalR.

---

## 2026-04-13 — Fix streak/compliance always zero (ID mismatch)

### Problem
After logging all of today's meals the mobile streak card still read 0,
and the trainer's compliance card showed 0% on the web. Cause: the
Mongo `MealLog.ClientId` and `NutritionPlan.ClientId` are stored as
`ClientProfile.PublicId`, but three endpoints were calling
`ComplianceService` with `ApplicationUser.Id` / `ClientProfile.UserId`.
The service's `FindActivePlanAsync` therefore never matched a plan and
always returned streak = 0 / compliance = 0%.

### Fix
- `Features/Client/Progress/GetComplianceScore/GetComplianceScoreEndpoint.cs`
  — inject `IApplicationDbContext`, resolve the client profile, pass
  `clientProfile.PublicId` into `ComplianceService` instead of the raw
  user claim.
- `Features/Client/Progress/GetWeeklyOverview/GetWeeklyOverviewEndpoint.cs`
  — same fix.
- `Features/Trainers/GetClientDashboard/GetClientDashboardEndpoint.cs`
  — switched the two `ComplianceService` calls from
  `clientProfile.UserId` to `clientProfile.PublicId`.
  Left the `QuestionnaireResponses` filter (line ~139) on
  `clientProfile.UserId` — that entity is keyed by UserId on purpose,
  matching the other questionnaire features.

### Notes
- `WorkoutLog.ClientId` is written as `ApplicationUser.Id` while
  `TrainingPlan.ClientId` / `MealLog.ClientId` / `NutritionPlan.ClientId`
  use `ClientProfile.PublicId`. The existing `GetClientTimelineEndpoint`
  passes `clientProfile.UserId` to all of them — it is
  correct for the Workout + Questionnaire pulls, but wrong for the
  nutrition/meal/training plan pulls. Flagged for a follow-up —
  intentionally left alone this round to keep the streak fix small.

---

## 2026-04-13 — Fix DateTime overflow + streak never incrementing

### Root cause
`ComplianceService.GetPlannedMealCountForDate` depended on
`plan.DatePublished` — but that field is **never set** anywhere in the
codebase; only `week.DatePublished` is written (in `PublishWeekEndpoint`).
As a result:

1. `GetPlannedMealCountForDate` always returned 0 (first guard hit).
2. `CalculateStreakAsync` therefore saw every day as "rest day — skip
   and decrement" and never hit its break condition, walking the date
   backwards indefinitely until `AddDays(-1)` on `DateTime.MinValue`
   overflowed through `AddTicks` →
   `ArgumentOutOfRangeException: un-representable DateTime`.
3. Even on days where this wouldn't have exploded, streak never
   incremented because no day was ever "planned".
4. `CalculateComplianceAsync` had the same bug — `MealsPlanned` was
   always 0 → compliance always 0 %.

### Fix
`backend/.../Infrastructure/Services/ComplianceService.cs`:

- `GetPlannedMealCountForDate(plan, date)` rewritten to anchor on
  `plan.StartDate` (which *is* set and is validated by `PublishWeek`):
  compute `weekNumber = daysSinceStart/7 + 1`,
  `dayOfWeek = daysSinceStart%7 + 1`, look up the matching `PlanWeek`
  and only count meals if `week.Status == WeekStatus.Published`.
- `CalculateStreakAsync` now derives a `floorDate` =
  `plan.StartDate + (earliestPublishedWeek.WeekNumber - 1) * 7` and
  walks back only while `currentDate >= floorDate`. If there is no
  published week, returns 0 early. This removes both the infinite
  loop and the `DateTime` overflow.
- `CalculateComplianceAsync` now returns early when
  `plan.StartDate` is null and delegates to the new helper.
- Removed the now-unused `GetAllPlanDays` helper and the
  `allDays/totalDays` parameters from `CountPlannedMeals` /
  `GetPlannedMealCountForDate`.

### Expected behaviour after rebuild
- Logging today's meals now causes `CurrentStreak = 1` via the
  `compliance-score` refetch triggered by the mobile mutation
  `onSuccess`.
- Web trainer client detail picks up matching streak + compliance via
  the SignalR `clientcomplianceupdated` invalidation added earlier
  today.

---

## 2026-04-14 — Replace calories stat card with weight trend (mobile Today)

### Problem
The upper-left "Kalorie" stat card on the Today screen duplicated the
calorie info already shown in the nutrition card hero just below.

### Change
`mobile/src/components/today/HasTrainerState.tsx`:
- Added `useQuery(['measurement-stats'], getMeasurementStats)` to fetch
  the client's latest weight and 30-day change from
  `GET /client/measurements/stats`.
- Replaced the `StatCard` from `calories / target kcal / progress bar`
  to `weight / ±change kg`. Shows "—" with sub "žádné měření" when no
  measurements exist. Positive change is orange, negative is green.
- Removed now-unused `targetKcal` and `kcalProgress` vars.

### i18n
- Added `today.weight` and `today.noMeasurements` keys in cs, en, de.
