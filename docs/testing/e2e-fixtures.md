# E2E fixture credentials

The compose harness (`docker-compose.test.yml`) seeds a deterministic set of QA users via `backend/FitnessPlatform.Application/Seed/QaSeedRunner.cs` before the API service starts.

The harness API listens on `https://localhost:<ephemeral-port>` with a self-signed dev cert — pass `-k` to curl, or `rejectUnauthorized: false` to Node `https`. The interactive dev API at `:5001` is a **separate** stack with a separate database; never point Playwright at it.

## scripts/test-env — branch-scoped CLI

`scripts/test-env` is the recommended entry point for the harness. It derives a per-branch `COMPOSE_PROJECT_NAME` so parallel CI runs (or two local checkouts) coexist on ephemeral host ports without colliding. Every call emits a JSON envelope to stdout so the orchestrator, `qa-tester`, and CI workflow can read the resolved API URL programmatically.

| Subcommand                          | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/test-env up [<branch>]`    | Bring up an isolated stack; prints `{"project","branch","api_url"}`.                        |
| `scripts/test-env down [<branch>]`  | Tear down + remove all volumes/networks for that branch's stack.                            |
| `scripts/test-env seed [--kind=K]`  | Re-run the seed container against the current branch's stack. `K`=`minimal`\|`rich`.        |
| `scripts/test-env run <flow>`       | Execute a named Playwright flow inside the harness (Phase 2+ — playwright container).      |
| `scripts/test-env logs <service>`   | Tail a service's logs (api/postgres-test/mongo-test/minio-test/seed/...).                   |
| `scripts/test-env health`           | curl the resolved api host port; print HTTP status.                                          |
| `scripts/test-env ports`            | Print the active stack's project name + resolved api host port.                              |

The CLI persists state to `.test-env.<project>.env` at the repo root (gitignored, removed on `down`). The host port for `api` is **ephemeral** — read it from the JSON envelope or via `npm run e2e:ports`. Do NOT assume `:5101`; that was the previous fixed mapping.

`npm run e2e:up` / `e2e:down` / `e2e:logs` / `e2e:health` are thin wrappers that call into the CLI — both interfaces work, but new automation should call `scripts/test-env` directly so the JSON envelope is parseable.

### Project-name derivation

Project names follow `fp-<sanitized-branch>-<sha1[:6]>`, where the sha1 is computed from `<branch>|<hostname>`. Same branch on the same host → same project name (deterministic, so re-running `up` on a half-up stack fails fast with a clear message instead of silently piling on). Different branches → different project names → coexist on different ephemeral ports.

### Two parallel runs (smoke)

```bash
# In one shell
scripts/test-env up feature/aaa
# {"project":"fp-feature-aaa-1f4d2b","branch":"feature/aaa","api_url":"https://localhost:53241"}

# In another shell
scripts/test-env up feature/bbb
# {"project":"fp-feature-bbb-9c7e0a","branch":"feature/bbb","api_url":"https://localhost:53248"}

docker ps --format '{{.Names}}'
# fp-feature-aaa-1f4d2b-api-1
# fp-feature-aaa-1f4d2b-postgres-test-1
# fp-feature-bbb-9c7e0a-api-1
# fp-feature-bbb-9c7e0a-postgres-test-1
# (etc.)
```

## Seeded users

| Role         | Email                            | Stable user id                            |
| ------------ | -------------------------------- | ----------------------------------------- |
| Client       | `qa.client@fitnessplatform.test` | `11111111-1111-1111-1111-111111111111`    |
| Trainer      | `qa.trainer@fitnessplatform.test`| `22222222-2222-2222-2222-222222222222`    |
| Nutritionist | `qa.nutri@fitnessplatform.test`  | `33333333-3333-3333-3333-333333333333`    |

All three accounts share the password held in `QA_SEED_PASSWORD` in your local `.env.test` (gitignored). Copy `.env.test.example` to `.env.test` and fill `JWT_SECRET` (≥32 chars) and `QA_SEED_PASSWORD` before the first `npm run e2e:up`. The seed runner refuses to start if `QA_SEED_PASSWORD` is unset, so a missing env file fails fast instead of creating users with a default password.

The GUIDs above are referenced by spec assertions and trainer↔client link fixtures — changing them is a fixture-version bump (update specs and any DB seeders that hard-code them in the same PR).

## Reset between specs

`POST https://localhost:<ephemeral-port>/test/reset` (no auth) drops and recreates the Postgres schema and Mongo collections, then re-runs `QaSeedRunner`. Playwright's `globalSetup` (`web/tests/e2e/global-setup.ts`, `mobile/tests/e2e/global-setup.ts`) calls it once per `playwright test` run so specs start from a known baseline. Resolve the host port with `scripts/test-env ports` or read it from the `up` JSON envelope; the previous fixed `:5101` mapping is gone.

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
# 0. Resolve the api URL for the current branch's stack
API_URL=$(scripts/test-env ports | jq -r '.api_url')

# 1. Log in as the QA client and capture the access token
ACCESS=$(curl -sk -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.client@fitnessplatform.test","password":"<QA_SEED_PASSWORD>"}' \
  | jq -r '.accessToken')

# 2. Fetch the client's training plans (should include the seeded plan)
curl -sk -H "Authorization: Bearer $ACCESS" \
  "$API_URL/client/plans" | jq '.items[] | select(.type=="training")'
```

Replace `<QA_SEED_PASSWORD>` with the value from your `.env.test` file. The plan
appears in the response because the week `Status = Published` — a Draft week would
be silently excluded by the `ElemMatch` filter in `GetClientPlansEndpoint`.

## Seeded foods, recipes, nutrition plan, blobs

Five foods, three recipes, and one nutrition plan are seeded by `QaSeedRunner` alongside the training plan. All constants are in `QaSeedRunner.cs`.

### Foods

| Constant              | External ID                              | Name                    | Category          |
| --------------------- | ---------------------------------------- | ----------------------- | ----------------- |
| `QaFood1ExternalId`   | `00000000-0000-0000-eeee-000000000001`   | Chicken Breast          | Meat              |
| `QaFood2ExternalId`   | `00000000-0000-0000-eeee-000000000002`   | White Rice (cooked)     | GrainsAndCereals  |
| `QaFood3ExternalId`   | `00000000-0000-0000-eeee-000000000003`   | Broccoli                | Vegetables        |
| `QaFood4ExternalId`   | `00000000-0000-0000-eeee-000000000004`   | Banana (medium)         | Fruit             |
| `QaFood5ExternalId`   | `00000000-0000-0000-eeee-000000000005`   | Rolled Oats             | GrainsAndCereals  |

All five foods are owned by the QA Nutri (`NutritionistId = NutriProfilePublicId = cccccccc-...`), visibility `Public`.

### Recipes

| Constant               | External ID                              | Name                           | Foods included            |
| ---------------------- | ---------------------------------------- | ------------------------------ | ------------------------- |
| `QaRecipe1ExternalId`  | `00000000-0000-0000-ffff-000000000001`   | Chicken, Rice & Broccoli Bowl  | Food 1 + Food 2 + Food 3  |
| `QaRecipe2ExternalId`  | `00000000-0000-0000-ffff-000000000002`   | Oats & Banana Breakfast        | Food 5 + Food 4           |
| `QaRecipe3ExternalId`  | `00000000-0000-0000-ffff-000000000003`   | Chicken & Broccoli Stir-fry    | Food 1 + Food 3           |

All three recipes are owned by the QA Nutri, visibility `Public`.

### Nutrition plan

| Constant                     | Value                                  | What it maps to                                    |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- |
| `QaNutritionPlanExternalId`  | `dddddddd-eeee-ffff-0000-111111111111` | The plan's `ExternalId`                            |
| `ClientProfilePublicId`      | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | `NutritionPlan.ClientId` (profile public id)       |
| `NutriProfilePublicId`       | `cccccccc-cccc-cccc-cccc-cccccccccccc` | `NutritionPlan.NutritionistId`                     |

Plan shape:

```
NutritionPlan (ExternalId = dddddddd-eeee-ffff-0000-111111111111)
  Status: Active
  Weeks:
    Week 1 (Status = Published, DatePublished set)
      Day 1 (Monday)
        Meal 1 — Breakfast  (08:00, no foods pre-loaded)
        Meal 2 — Lunch      (12:00, no foods pre-loaded)
        Meal 3 — Dinner     (18:00, no foods pre-loaded)
```

### Blob assets

| Constant              | MinIO key                            | Content          |
| --------------------- | ------------------------------------ | ---------------- |
| `QaAvatarBlobKey`     | `avatars/qa-client-11111111.png`     | 1×1 pixel PNG    |
| `QaFoodImageBlobKey`  | `foods/qa-food-1.png`                | 1×1 pixel PNG    |

Both blobs are loaded from embedded resources (`Seed/Assets/qa-avatar.png` and `qa-food.png`) and uploaded to MinIO via `IBlobStorageService.UploadAsync` during seed. Upload is idempotent: `ObjectExistsAsync` is checked first; existing blobs are left in place.

## CI

The `e2e.yml` GitHub Actions workflow sources `JWT_SECRET` and `QA_SEED_PASSWORD` from repository-level secrets (`secrets.JWT_SECRET`, `secrets.QA_SEED_PASSWORD`) and writes them into `.env.test` before `npm run e2e:up`. Configure these secrets at `Settings → Secrets and variables → Actions` before the first CI run, or the workflow will fail at the env-file write step with a clear error message.

> **Compose harness rebuild.** After this change merges, rebuild the harness API image
> (`docker compose -f docker-compose.test.yml build api`) so `npm run e2e:up` picks up
> the new seed. The image is not rebuilt automatically on `npm run e2e:up` unless the
> Dockerfile or its dependencies change.
