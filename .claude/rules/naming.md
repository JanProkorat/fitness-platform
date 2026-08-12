---
description: Naming conventions for files, types, routes, and identifiers
---

# Naming Conventions

> **Descriptive.** Counts below were measured against
> `backend/FitnessPlatform.Application` on `develop` at `dc990021` (issue
> #937).

## Files and types

One type per file, and the file name matches the primary type name exactly.

**One documented exception:** a `*Response.cs` file may also declare the
nested payload DTOs that only that response uses — e.g.
`ClientTraining/GetFullPlan/GetFullTrainingPlanResponse.cs` declares 6
types. That is the established shape; don't split them out, and don't
promote them to `Shared/` unless a second action consumes them.

No nested public types (a type declared *inside* another type) — the
exception above is about several top-level types per file, not nesting.

## File naming patterns

```
GetPlanEndpoint.cs                  // {Action}Endpoint.cs — 233 files
GetPlansEndpoint.cs                 // plural for list endpoints
GetCurrentUserOrdersEndpoint.cs     // context qualifier

CreatePlanRequest.cs                // {Action}Request.cs   — 178 files
GetPlanResponse.cs                  // {Action}Response.cs  — 118 files
CreatePlanValidator.cs              // {Action}Validator.cs — 111 files

PlanSummaryDto.cs                   // Shared/ — reused by 2+ actions in the area
SessionTemplateErrors.cs            // Shared/ — feature-scoped error table
```

Endpoint class names are **globally unique across the assembly** because
`ShortNames = true` — see `rules/api-design.md#endpoint-names`. Prefix by
domain (`SearchSessionTemplatesEndpoint`), never bare (`SearchEndpoint`).

Endpoint responses are classes, not records — see
`rules/csharp-style.md#records-for-dtos`.

## Error codes

`SCREAMING_SNAKE_CASE` values on the flat `ErrorCodes` static class —
`PLAN_NOT_FOUND`, `RECIPE_NOT_OWNED`. Frontend localization keys, stable
across releases. Full structure and the two known outliers:
`rules/validation.md#error-codes`.

## Migrations

Descriptive, present tense `{Verb}{Target}`, in
`Infrastructure/Data/Migrations/`. Matches the shipped history:

```
AddWeeklyCheckInConfig
RemoveTrainerYearsOfExperience
RenameToProfessionalProfile
AddNutritionTargetsToOnboarding
```

## Test naming

`{Method}_{StateUnderTest}_{ExpectedBehavior}`. Matches the shipped suite:

```csharp
HandleAsync_OrderNotFound_Returns404
HandleAsync_UserHasNoPermission_Returns403
SeedAsync_RunTwice_IsIdempotent
MigrationFold_EmptyProgressPhotos_ProducesZeroPlanPhotos
Validate_EmptyCustomerId_FailsWithCorrectCode
```

## Local variable naming

Local variables MUST have descriptive names. The following identifier shapes
are **forbidden**:

- One or two-character names.
- camelCase abbreviations of unfamiliar tokens (`isWo`, `plnId`).
- Abbreviations of domain terms (`pln` for `planning`, `snap` for
  `snapshot`).

Allowed exceptions:

- Loop counters: `i` in `for` / `foreach (var i in Enumerable.Range(...))`.
- LINQ lambda parameters: `o` in `orders.Where(o => o.Total > 100)`.
- Caught exception: `ex` in `catch (Exception ex)`.
- Discards: `_` in tuple deconstruction, unused lambda parameters, `out _`.
- Established repo conventions: `ct` (`CancellationToken`), `req`
  (FastEndpoints request param), `app` (integration-test fixture), `db`
  (`DbContext` param, when scope is obvious), `mongo` (`IMongoContext`).
