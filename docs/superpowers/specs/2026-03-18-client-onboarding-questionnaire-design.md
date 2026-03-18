# Client Onboarding Questionnaire — Design Spec

## Goal

After a Client registers on the mobile app, force a 7-step onboarding wizard that collects health, lifestyle, nutrition, and motivation data. This data helps nutritionists create precise macro-based plans. The questionnaire mirrors the existing HTML prototype at `docs/onboarding_questionnaire.html`.

## Architecture

- New `ClientOnboardingData` entity (PostgreSQL, one-to-one with `ClientProfile`) stores all questionnaire answers
- `ClientProfile` gains `IsOnboardingComplete` boolean flag
- New `POST /client/onboarding` endpoint saves questionnaire + sets flag
- `GET /users/me` response gains `isOnboardingComplete` field
- Mobile auth store tracks `isOnboardingComplete`; AuthGate redirects Client users to `/(auth)/onboarding` until complete
- Mobile onboarding screen is a 7-step wizard matching the HTML prototype

## Backend

### ClientOnboardingData Entity

New entity extending `TimestampableEntity` (internal only, never exposed directly via API):

```
ClientOnboardingData
├── ClientProfileId (long, FK to ClientProfile.Id)
│
│   Step 1 — Basics
├── DateOfBirth (DateTime) — synced to ClientProfile.DateOfBirth
├── Sex (Sex enum: Male, Female)
├── HeightCm (decimal)
├── WeightKg (decimal)
├── TargetWeightKg (decimal?)
├── BodyType (BodyType enum: Ectomorph, Mesomorph, Endomorph)
│
│   Step 2 — Goal
├── PrimaryGoal (PrimaryGoal enum: LoseFat, GainMuscle, Recomposition, Fitness, Health)
├── TimeHorizon (TimeHorizon enum: ThreeMonths, SixMonths, OneYear)
│
│   Step 3 — Lifestyle
├── JobType (JobType enum: Sedentary, Standing, Physical)
├── SleepHours (int, 4-10)
├── StressLevel (int, 1-5)
│
│   Step 4 — Activity
├── CurrentTrainingFrequency (CurrentTrainingFrequency enum: None, Occasional, Regular, High)
├── DesiredTrainingFrequency (DesiredTrainingFrequency enum: TwoPerWeek, ThreePerWeek, FourPerWeek, FivePerWeek)
├── FitnessRating (int, 1-10)
│
│   Step 5 — Equipment & Preferences
├── GymAccess (GymAccess enum: Yes, Sometimes, No)
├── PreferredActivities (string, comma-separated: strength,cardio,hiit,yoga,cycling,martial_arts)
├── Injuries (string, comma-separated: none,back,knees,shoulders)
│
│   Step 6 — Nutrition
├── MealsPerDay (MealsPerDay enum: TwoToThree, FourToFive, SixPlus)
├── DietaryStyle (DietaryStyle enum: Standard, Vegetarian, Vegan, GlutenFree)
├── Allergies (string, comma-separated: none,lactose,gluten,nuts)
├── DietRating (int, 1-5)
│
│   Step 7 — Motivation
├── PlanExperience (PlanExperience enum: Never, TriedFailed, TriedSucceeded)
├── PastBlockers (string, comma-separated: time,motivation,knowledge,slow_results,none)
├── PrimaryMotivation (PrimaryMotivation enum: Appearance, Health, Performance, Confidence)
│
└── ClientProfile (navigation)
```

Multi-select fields (PreferredActivities, Injuries, Allergies, PastBlockers) are stored as comma-separated strings. This is simple and these are fixed small sets that don't need querying.

### ClientProfile Changes

Add to `ClientProfile`:
```csharp
public bool IsOnboardingComplete { get; set; }
public ClientOnboardingData? OnboardingData { get; set; }
```

When onboarding is submitted, also sync `HeightCm`, `WeightKg`, and `DateOfBirth` from the questionnaire into `ClientProfile` (the existing fields).

Note: The HTML prototype collects "age" as an integer, but we store it as `DateOfBirth` (DateTime). The mobile app will present an age input and convert it to an approximate DateOfBirth (Jan 1 of the birth year). This keeps consistency with the existing `ClientProfile.DateOfBirth` field.

### Enums

All new enums go in `Domain/Enums/`:
- `Sex` (Male, Female)
- `BodyType` (Ectomorph, Mesomorph, Endomorph)
- `PrimaryGoal` (LoseFat, GainMuscle, Recomposition, Fitness, Health)
- `TimeHorizon` (ThreeMonths, SixMonths, OneYear)
- `JobType` (Sedentary, Standing, Physical)
- `CurrentTrainingFrequency` (None, Occasional, Regular, High)
- `DesiredTrainingFrequency` (TwoPerWeek, ThreePerWeek, FourPerWeek, FivePerWeek)
- `GymAccess` (Yes, Sometimes, No)
- `MealsPerDay` (TwoToThree, FourToFive, SixPlus)
- `DietaryStyle` (Standard, Vegetarian, Vegan, GlutenFree)
- `PlanExperience` (Never, TriedFailed, TriedSucceeded)
- `PrimaryMotivation` (Appearance, Health, Performance, Confidence)

### POST /client/onboarding Endpoint

- Route: `POST /client/onboarding`
- Auth: requires Client role
- Request body: flat JSON with all questionnaire fields (using string values for enums, parsed server-side)
- Validation: FluentValidation — all required fields present, numeric ranges enforced:
  - HeightCm: 140–220
  - WeightKg: 40–250
  - TargetWeightKg: 40–250 (if provided)
  - SleepHours: 4–10
  - StressLevel: 1–5
  - FitnessRating: 1–10
  - DietRating: 1–5
  - DateOfBirth: must be between 15 and 80 years ago
- Logic:
  1. Get current user's ClientProfile
  2. Create ClientOnboardingData, attach to profile
  3. Sync HeightCm and WeightKg to ClientProfile
  4. Set `IsOnboardingComplete = true`
  5. Save
  6. Return 200 with `{ message: "Onboarding complete" }`
- Idempotent: if already complete, replace existing data
- GDPR: log onboarding data submission to AuditLog (health data is Art. 9 special category)

### GET /users/me Changes

Add `IsOnboardingComplete` to `GetProfileResponse`. Only meaningful for Client role — return `null` for non-client users.

Logic: when user has Client role, load `ClientProfile` and return `IsOnboardingComplete`.

## Mobile

### Auth Store Changes

Add `isOnboardingComplete: boolean | null` to the User interface and auth store. Populated from `GET /users/me` response during both `restoreSession()` and `login()`. The `login()` action must also accept and store this field. After successful onboarding POST, update the store directly to `true`.

### AuthGate Changes

In `_layout.tsx` AuthGate, update the routing logic. The existing code redirects all authenticated users in the `(auth)` group to `/(client)`. This must be modified to carve out the onboarding route:

```
if (!isAuthenticated && !inAuthGroup) → /(auth)/login
else if (isAuthenticated && inAuthGroup && segments[1] !== 'onboarding') → check onboarding
  if (user is Client && isOnboardingComplete === false) → /(auth)/onboarding
  else → /(client)
else if (isAuthenticated && !inAuthGroup && user is Client && isOnboardingComplete === false) → /(auth)/onboarding
```

Key: an authenticated user on the onboarding screen must NOT be redirected away from it. The `segments[1] !== 'onboarding'` guard prevents the redirect loop.

### Onboarding Screen

New file: `mobile/app/(auth)/onboarding.tsx`

A 7-step wizard with:
- Progress bar at top (gold fill, matches HTML prototype)
- Step counter ("Step 1 of 7")
- Each step shows title, subtitle, and fields matching the HTML prototype exactly
- Navigation: "Back" and "Continue" buttons
- Per-step validation before advancing
- After step 7: summary/confirmation screen (not counted as a step — progress bar shows 100%) displaying all answers
- Submit button on summary: POST `/client/onboarding`, then update auth store and navigate to `/(client)`

State management: single `useState` object accumulating answers across steps, plus `currentStep` state.

UI components per field type:
- **Text inputs** (age, height, weight): standard `TextInput` with numeric keyboard
- **Single select** (body type, goal, etc.): `TouchableOpacity` pills/cards, same pattern as role picker on register screen
- **Multi-select** (activities, injuries, allergies, blockers): checkbox items with toggle
- **Scale** (stress 1-5, fitness 1-10, diet 1-5): row of numbered buttons
- **Slider** (sleep hours): `TextInput` with range or scale buttons

All styled to match the existing dark theme (Colors.dark.*, gold accents).

## Data Flow

```
Register → Auto-login → GET /users/me (isOnboardingComplete=false)
  → AuthGate redirects to /(auth)/onboarding
  → User fills 7 steps → POST /client/onboarding
  → Auth store: isOnboardingComplete=true
  → AuthGate redirects to /(client)
```

On subsequent logins, `restoreSession` → `GET /users/me` returns `isOnboardingComplete=true` → normal `/(client)` redirect.

## Testing

### Backend Tests
- `ClientOnboardingData` entity configuration (EF Core)
- `POST /client/onboarding` endpoint: happy path, validation errors, non-client user rejected, idempotent re-submission
- `GET /users/me`: returns `isOnboardingComplete` for client users, `null` for non-clients

### Mobile
- Manual testing: full wizard flow, validation per step, back navigation, submit and redirect
