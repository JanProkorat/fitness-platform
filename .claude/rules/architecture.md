---
description: Vertical slice architecture rules for the FitnessPlatform .NET backend
---

# Architecture Rules

> **Descriptive unless marked otherwise.** Every claim below was measured
> against `backend/FitnessPlatform.Application` on `develop` at `dc990021`
> (issue #937). Where a rule is aspirational — a direction for new code that
> most of the existing code does not follow — it is labelled
> **[ASPIRATIONAL]** and states the current count. Do not read an
> aspirational rule as a description of the codebase, and do not open a
> finding against existing code for failing it.

The backend is **one project** — `FitnessPlatform.Application` (plus
`FitnessPlatform.Tests`). Feature code is organised as vertical slices under
`Features/`; everything shared across slices lives under `Domain/` or
`Infrastructure/`. See #vertical-slice-layout and #shared-layers.

## Vertical slice layout

Every feature lives in `FitnessPlatform.Application/Features/{Area}/` — one
type per file, co-located, nested one folder per action. 233 endpoint files
across 27 area folders follow this shape; the per-action nesting is
universal, not optional.

```
Features/NutritionPlans/
  CreatePlan/  { CreatePlanEndpoint.cs, CreatePlanRequest.cs, CreatePlanValidator.cs }
  GetPlan/     { GetPlanEndpoint.cs, GetPlanRequest.cs, GetPlanResponse.cs }
  GetPlans/    { GetPlansEndpoint.cs, GetPlansRequest.cs, GetPlansResponse.cs, GetPlansValidator.cs }
  UpdatePlan/  { UpdatePlanEndpoint.cs, UpdatePlanRequest.cs, UpdatePlanValidator.cs }
  Shared/      { PlanSummaryDto.cs }
```

A `Shared/` sub-folder holds DTOs and error tables reused by two or more
actions in the same area (10 areas have one). Feature-scoped error tables
live there too — `Features/SessionTemplates/Shared/SessionTemplateErrors.cs`,
`Features/MealTemplates/Shared/MealTemplateErrors.cs`. There is no `Errors/`
folder convention (0 exist).

There is **no** `{Feature}FeatureConfiguration` type and no
`IFeatureConfiguration` interface in this backend — a slice's root folder
holds nothing but its action folders and (optionally) `Shared/`. Swagger
grouping comes from FastEndpoints' route-derived tags, not from a
per-feature configuration object. (A rule requiring one was removed in #937;
it had 0 occurrences and had never existed here.)

## Shared layers

Two shared trees sit alongside `Features/`. Both are load-bearing — this
backend is **not** a features-only tree.

| Folder | Holds | Size |
|---|---|---|
| `Domain/Common/` | Entity base classes (`BaseEntity`, `TimestampableEntity`, `PublicTimestampableEntity`) and their interfaces | — |
| `Domain/Constants/` | `AppRoles`, `AppClaims`, `ErrorCodes`, `MongoCollections` | — |
| `Domain/Entities/` | EF Core / PostgreSQL entities | 30 files |
| `Domain/Documents/` | MongoDB document classes | 46 files |
| `Domain/Enums/` | Domain enums | — |
| `Domain/Extensions/` | Endpoint extension methods (`SendProblemAsync`, library-denial and plan-load helpers) | — |
| `Domain/Interfaces/` | Service interfaces | 18 files |
| `Domain/Services/` | Cross-feature domain helpers — `PlanConcurrencyGuard`, `PlanWindowResolver`, `ClientVerdictService`, `LibraryAccessGuard`, `LibrarySearchHelper` | 5 files |
| `Infrastructure/Data/` | `ApplicationDbContext`, `MongoContext`, EF migrations | — |
| `Infrastructure/Services/` | External integrations and background work — email, push, blob, macro calculation, schedulers | 33 files |
| `Infrastructure/Hubs/` | SignalR `NotificationHub`, presence tracking | — |
| `Middleware/` | Global exception handler, locale capture | — |
| `Seed/` | Seed data + runners | — |

## No horizontal layers

Scoped rule, not a blanket ban. **Feature logic** does not get its own
service layer: a slice's business logic lives in its endpoint's
`HandleAsync`, grown by extracting `private` methods on the same class. Do
not add a `Features/{Area}/Services/` folder, a per-feature handler type, or
a `{Feature}Service` class to hold what the endpoint should own.

What *is* allowed, and widely used:

- **`Domain/Services/`** for a helper genuinely shared by two or more slices
  (5 files today). A guard or resolver used by one slice belongs in that
  slice's endpoint; promote it only on the second caller.
- **`Infrastructure/Services/`** for anything crossing a process boundary —
  email, push, blob storage, HTTP clients, hosted background services (33
  files today).
- **`Domain/Extensions/`** for endpoint extension methods that let several
  slices share a load-and-authorize sequence
  (`LoadOwnedNutritionPlanIfAllowedAsync`,
  `LoadLibraryEntryForReadOrRespondAsync`, `SendProblemAsync`).

Cross-feature references between two `Features/{Area}` namespaces are still
the smell: the shared thing goes to `Domain/` instead.

## Banned patterns

These four are genuinely absent from the backend and must stay absent —
each measured at **0** occurrences:

- **Mapping libraries** (AutoMapper, Mapster) — hand-write projections with
  `Select`, or a static `FromDocument`/`FromEntity` factory on the response
  type (the established form: `GetPlanResponse.FromDocument(...)`).
- **MediatR / `IRequest<T>` handlers** — the endpoint owns the logic.
- **The repository pattern** — see #no-repository-pattern.
- **`#region` / `#endregion`** — see `rules/csharp-style.md#no-regions`.

Not banned, contrary to what this file said before #937:
`Domain/`, `Infrastructure/`, `Domain/Services/` and
`Infrastructure/Services/` are the actual layout — see #shared-layers.

## No repository pattern

Inject `IApplicationDbContext` / `IMongoContext` directly into endpoints via
the primary constructor. No repository interface, no wrapper class — EF Core
is already a Unit-of-Work + Repository implementation, and the Mongo driver
is accessed through `IMongoContext`'s typed collection properties.

`IRepository` appears 0 times in the backend. All 233 endpoints use a
primary constructor for their dependencies; 91 take `ApplicationDbContext`
directly.

```csharp
public class GetPlanEndpoint(IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper authHelper)
    : Endpoint<GetPlanRequest, GetPlanResponse>
```

## One type per file

See `rules/naming.md#files-and-types`.

## Project layout

Two projects, no `.Shared` / `.Infrastructure` split:

- `FitnessPlatform.Application` — `Microsoft.NET.Sdk.Web`, `net10.0`,
  `Nullable`/`ImplicitUsings` enabled, `GenerateDocumentationFile=true` with
  `NoWarn=1591`. Holds endpoints, domain, infrastructure wiring, migrations,
  seed data.
- `FitnessPlatform.Tests` — xUnit v3 + Testcontainers.

Types shared with the web and mobile clients are not shared via a project
reference — the clients consume generated TypeScript from Swagger (see the
`regen-api` skill). There is no `FitnessPlatform.Shared` project; do not
cite one.
