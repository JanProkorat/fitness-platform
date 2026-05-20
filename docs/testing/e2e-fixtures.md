# E2E fixture credentials

The compose harness (`docker-compose.test.yml`, brought up via `npm run e2e:up`) seeds a deterministic set of QA users via `backend/FitnessPlatform.Application/Seed/QaSeedRunner.cs` before the API service starts.

The harness API listens on `https://localhost:5101` with a self-signed dev cert — pass `-k` to curl, or `rejectUnauthorized: false` to Node `https`. The interactive dev API at `:5001` is a **separate** stack with a separate database; never point Playwright at it.

## Seeded users

| Role         | Email                            | Stable user id                            |
| ------------ | -------------------------------- | ----------------------------------------- |
| Client       | `qa.client@fitnessplatform.test` | `11111111-1111-1111-1111-111111111111`    |
| Trainer      | `qa.trainer@fitnessplatform.test`| `22222222-2222-2222-2222-222222222222`    |
| Nutritionist | `qa.nutri@fitnessplatform.test`  | `33333333-3333-3333-3333-333333333333`    |

All three accounts share the password held in `QA_SEED_PASSWORD` in your local `.env.test` (gitignored). Copy `.env.test.example` to `.env.test` and fill `JWT_SECRET` (≥32 chars) and `QA_SEED_PASSWORD` before the first `npm run e2e:up`. The seed runner refuses to start if `QA_SEED_PASSWORD` is unset, so a missing env file fails fast instead of creating users with a default password.

The GUIDs above are referenced by spec assertions and trainer↔client link fixtures — changing them is a fixture-version bump (update specs and any DB seeders that hard-code them in the same PR).

## Reset between specs

`POST https://localhost:5101/test/reset` (no auth) drops and recreates the Postgres schema and Mongo collections, then re-runs `QaSeedRunner`. Playwright's `globalSetup` (`web/tests/e2e/global-setup.ts`, `mobile/tests/e2e/global-setup.ts`) calls it once per `playwright test` run so specs start from a known baseline.

The endpoint is **double-gated**: it only responds when `Testing__Enabled=true` AND `ASPNETCORE_ENVIRONMENT=Development`. The compose stack hard-codes both — the dev API at `:5001` does not, so calling `/test/reset` against the dev API correctly returns 404. It is also hidden from `/swagger/v1/swagger.json` via `ExcludeFromDescription()`, so a prod scanner cannot enumerate it via the OpenAPI document.

## Seeded training plans

A deterministic training plan is seeded for the QA client on every `/test/reset` call.

### Stable GUIDs

| Constant                          | Value                                  | What it maps to                                    |
| --------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `QaTrainingPlanExternalId`        | `dddddddd-dddd-dddd-dddd-dddddddddddd` | The plan's `ExternalId` (used in API responses)    |
| `ClientProfilePublicId`           | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | `TrainingPlan.ClientId` (NOT the user id — see note) |
| `TrainerProfilePublicId`          | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | `TrainingPlan.TrainerId`                           |
| `ForTimeSectionId`                | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` | `TrainingSection.SectionId` for Section 1          |
| `AmrapSectionId`                  | `ffffffff-ffff-ffff-ffff-ffffffffffff` | `TrainingSection.SectionId` for Section 2          |
| `StandardSectionId`               | `00000000-0000-0000-aaaa-000000000001` | `TrainingSection.SectionId` for Section 3          |
| `QaSessionId`                     | `00000000-0000-0000-bbbb-000000000001` | `TrainingSession.SessionId`                        |

> **Note on ClientId.** `TrainingPlan.ClientId` is keyed on `ClientProfile.PublicId`
> (the profile's public identifier, `aaaaaaaa-...`), **not** on `ApplicationUser.Id`
> (`11111111-...`). `GET /client/plans` filters by `ClientProfile.PublicId`. Using the
> user id directly would make the plan invisible to that endpoint.

### Seeded plan shape

```
TrainingPlan (ExternalId = dddddddd-...)
  Status: Active
  Weeks:
    Week 1 (Status = Published, DatePublished set)
      Session "QA Session" (DayOfWeek = 1 = Monday)
        Section 1 "ForTime 30min"
          Format:        ForTime
          TimeCapSeconds: 1800  (30 minutes)
          Exercises:     []     ← intentionally empty (#258 non-regression)
        Section 2 "AMRAP test"
          Format:        AMRAP
          TimeCapSeconds: 600   (10 minutes)
          Exercises:     [QA Pull-up, QA Box Jump]
        Section 3 "Standard test"
          Format:        null   (Standard)
          Exercises:     [QA Squat, QA Deadlift]
```

### Curl recipe — fetch as the QA client

```bash
# 1. Log in as the QA client and capture the access token
ACCESS=$(curl -sk -X POST https://localhost:5101/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.client@fitnessplatform.test","password":"<QA_SEED_PASSWORD>"}' \
  | jq -r '.accessToken')

# 2. Fetch the client's training plans (should include the seeded plan)
curl -sk -H "Authorization: Bearer $ACCESS" \
  https://localhost:5101/client/plans | jq '.items[] | select(.type=="training")'
```

Replace `<QA_SEED_PASSWORD>` with the value from your `.env.test` file. The plan
appears in the response because the week `Status = Published` — a Draft week would
be silently excluded by the `ElemMatch` filter in `GetClientPlansEndpoint`.

## CI

The `e2e.yml` GitHub Actions workflow sources `JWT_SECRET` and `QA_SEED_PASSWORD` from repository-level secrets (`secrets.JWT_SECRET`, `secrets.QA_SEED_PASSWORD`) and writes them into `.env.test` before `npm run e2e:up`. Configure these secrets at `Settings → Secrets and variables → Actions` before the first CI run, or the workflow will fail at the env-file write step with a clear error message.

> **Compose harness rebuild.** After this change merges, rebuild the harness API image
> (`docker compose -f docker-compose.test.yml build api`) so `npm run e2e:up` picks up
> the new seed. The image is not rebuilt automatically on `npm run e2e:up` unless the
> Dockerfile or its dependencies change.
