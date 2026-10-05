---
name: dotnet-feature
description: Scaffold a FastEndpoints vertical slice in this backend — Features/{Area}/{Action}/ with endpoint, request, response and validator, following .claude/rules. Use when adding a new endpoint, command, query, CRUD op or API route. Tests go through dotnet-tdd; migrations through dotnet-migrate.
argument-hint: "<Area> <Action> <description>"
---

# Feature scaffolding

**Arguments:** `$ARGUMENTS` — e.g. `MealTemplates Archive "Archive a meal template"`.

The rules files are the source of truth. This skill gives the order of work
and a skeleton; every convention it names lives in a rule, cited by anchor.
Where this file and a rule disagree, **the rule wins** — fix this file.

## When not to use

- Test-first flow → `dotnet-tdd` (it calls back here for the GREEN step).
- A new EF entity's migration → `dotnet-migrate`. Generate, read `Up()`, never apply.
- A new MongoDB root document → `mongo-document`.
- Convention check after writing → `dotnet-review`.

## Required rules

Read before writing — nothing under `rules/` loads itself:

- `rules/architecture.md` — #vertical-slice-layout, #shared-layers, #no-horizontal-layers, #banned-patterns.
- `rules/api-design.md` — #configure-structure, #endpoint-names, #empty-request-dtos-crash-at-boot, #handleasync-body, #extract-guards-when-many, #send-pattern, #authorization, #routes.
- `rules/validation.md` — #validator-class, #error-codes, #what-goes-where.
- `rules/error-handling.md` — #send-for-expected-errors.
- `rules/naming.md` — #files-and-types, #file-naming-patterns.
- `rules/csharp-style.md` — #records-for-dtos, #timeprovider, #entity-identity, #guard-clauses, #xml-documentation.
- `rules/ef-core.md` — only if the slice touches EF (#entities, #asnotracking, #projections).

## Steps

1. **Clarify only what you can't infer:** route, roles, request fields, which
   caller may act on which data (ownership), and the coded errors the client
   must tell apart. Record assumptions in your handoff.
2. **Read one exemplar of the same shape** before writing:
   - EF read + link check: `Features/ClientMeasurements/GetClientMeasurements/`.
   - Mongo read via a shared load-and-authorize extension: `Features/NutritionPlans/GetPlan/`.
   - Newer slice, `internal sealed` + `TimeProvider`: `Features/MealTemplates/CreateMealTemplate/`.
   - Otherwise glob `Features/*/*/*Endpoint.cs` for the nearest match.

   Copy their structure, not their `Summary` — most list fewer `Responses`
   than they return. The skeleton below is the standard.
3. **Write in this order:** `Request` → `Validator` → `Response` → `Endpoint`.
4. **New storage?** EF entity → base class per `rules/ef-core.md#entities`,
   register the `DbSet`, then hand off to `dotnet-migrate`. Mongo root
   document → `mongo-document`.
5. **Tests** → `dotnet-tdd`, at the layers `rules/testing.md` prescribes.
6. Build (`dotnet-build`), then suggest `dotnet-review`.

## Layout

```
Features/{Area}/
├── {Action}/
│   ├── {Action}Endpoint.cs
│   ├── {Action}Request.cs      # omit only for EndpointWithoutRequest
│   ├── {Action}Response.cs     # omit for 204-only endpoints
│   └── {Action}Validator.cs    # body or non-trivial params
└── Shared/                     # only once 2+ actions share a DTO or error table
```

There is no feature-configuration class, no `Commands/`/`Queries/` split and
no `Errors/` folder in this backend (`rules/architecture.md#vertical-slice-layout`).

## Skeletons

The running example is invented: `MealTemplate` has no `ArchivedAt` field
today. Copy the shape, not the names.

### Request

```csharp
/// <summary>
/// Request for archiving a meal template.
/// </summary>
public class ArchiveMealTemplateRequest
{
    /// <summary>Route parameter — matches `{TemplateId}` in the route exactly.</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Optional reason shown to the coach.</summary>
    public string? Reason { get; set; }
}
```

A request with **zero properties crashes the app at boot** — use
`EndpointWithoutRequest<TResponse>` instead (`rules/api-design.md#empty-request-dtos-crash-at-boot`).

### Validator

```csharp
/// <summary>
/// Validates the <see cref="ArchiveMealTemplateRequest"/>.
/// </summary>
internal sealed class ArchiveMealTemplateValidator : Validator<ArchiveMealTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for archiving a meal template.
    /// </summary>
    public ArchiveMealTemplateValidator()
    {
        RuleFor(x => x.Reason)
            .MaximumLength(500);
    }
}
```

FastEndpoints' `Validator<T>`, never `AbstractValidator<T>`; accessibility
matches the endpoint and the surrounding slice. Domain rules carry
`.WithErrorCode(ErrorCodes.X)` plus `.WithMessage(...)`; plain shape checks
usually don't (`rules/validation.md#validator-class`).

### Response

```csharp
/// <summary>
/// Archived meal template summary.
/// </summary>
public class ArchiveMealTemplateResponse
{
    /// <summary>Public id of the template.</summary>
    public Guid TemplateId { get; set; }

    /// <summary>When the template was archived (UTC).</summary>
    public DateTime ArchivedAt { get; set; }

    /// <summary>Maps the stored document to the response.</summary>
    public static ArchiveMealTemplateResponse FromDocument(MealTemplate template) => new()
    {
        TemplateId = template.ExternalId,
        ArchivedAt = template.ArchivedAt!.Value,
    };
}
```

A plain class with a `FromDocument` / `FromEntity` factory, not a record
(`rules/csharp-style.md#records-for-dtos`). Expose `PublicId` / `ExternalId`,
never an EF `long Id` (`rules/csharp-style.md#entity-identity`).

### Endpoint

```csharp
/// <summary>
/// Archives one of the caller's meal templates.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class ArchiveMealTemplateEndpoint(IMongoContext mongo, TimeProvider timeProvider)
    : Endpoint<ArchiveMealTemplateRequest, ArchiveMealTemplateResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/meal-templates/{TemplateId}/archive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Archive a meal template";
            s.Description = "Hides the caller's own meal template from the library.";
            s.Responses[StatusCodes.Status200OK] = "Archived template";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Template not found, or not owned by the caller";
            s.Responses[StatusCodes.Status409Conflict] = "Template is already archived";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ArchiveMealTemplateRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        // Load + ownership guard, archive, save — see the rules below.
        // Expected failure with a code the client branches on:
        //   await this.SendProblemAsync(409, ErrorCodes.X, "…", ct); return;
        // Success:
        //   await Send.OkAsync(ArchiveMealTemplateResponse.FromDocument(template), ct);
        // No body to return → Send.NoContentAsync(ct), drop the Response type, document 204.
    }
}
```

What each line is answering:

- **Route** — absolute, domain prefix first, kebab-case segments, PascalCase
  parameter matching the request property (`rules/api-design.md#routes`).
- **Roles** — `Roles(AppRoles.X, …)` varargs form, never a string literal or
  `Policies(...)` (`rules/api-design.md#authorization`).
- **Ownership** — a role is not an ownership check. Any endpoint that touches a
  specific client's data verifies the caller's live link and capability —
  `IClientLinkAuthorizationService.GetCapabilitiesByClientPublicIdAsync` /
  `…ByClientUserIdAsync` return `LinkCapabilities?` (`null` = no live link) —
  or reuses an existing `Load…IfAllowedAsync` extension from `Domain/Extensions/`.
- **Summary** — mandatory, with a `Responses[...]` entry for every status the
  endpoint can return (`rules/api-design.md#configure-structure`).
- **Responses** — `Send.*Async(ct)` for bare statuses, `this.SendProblemAsync`
  for a coded ProblemDetails, `this.ThrowErrorWithCode` for a coded 400. Always
  `return;` after a `Send` (`rules/error-handling.md#send-for-expected-errors`).
  It is `Send.ForbiddenAsync`, not `ForbidAsync`; `Send.ErrorsAsync` is not used.
- **Three or more guards** → extract `Load{Entity}OrRespondAsync` / reuse an
  extension (`rules/api-design.md#extract-guards-when-many`).
- **Class name** — globally unique across the assembly and domain-prefixed;
  a duplicate crashes the app at boot (`rules/api-design.md#endpoint-names`).
- **Accessibility** — `internal sealed` is preferred for new code; matching the
  surrounding slice's `public class` is equally fine (`rules/api-design.md#class-accessibility`).
- **Clock** — inject `TimeProvider` in new code (`rules/csharp-style.md#timeprovider`).
- **Data** — EF reads `AsNoTracking()` + `Select` projection; Mongo through
  `IMongoContext`'s typed collections. No repositories, no MediatR, no mapping
  library (`rules/architecture.md#banned-patterns`).
- **Optional:** `DontCatchExceptions()` — allowed, not required
  (`rules/api-design.md#dont-catch-exceptions`).

## Don't

- Don't add a `{Feature}FeatureConfiguration`, `.WithTag(...)`, `Policies(...)`,
  `Permissions(...)` or an `AuthorizationPolicies` class — none exist here.
- Don't call into another `Features/{Area}` namespace; move the shared piece to
  `Domain/` (`rules/architecture.md#no-horizontal-layers`).
- Don't apply a migration, only generate it via `dotnet-migrate`.
- Don't add per-endpoint "no auth → 401" or "wrong role → 403" tests; the
  architecture test covers them (`rules/testing.md#authorization`).

## Done when

- [ ] Files match the layout above; one type per file; XML docs on public/internal members.
- [ ] Every rule in "Required rules" is satisfied — re-read the anchors, don't trust memory.
- [ ] `dotnet-build` passes.
- [ ] The app still boots (new endpoint name unique, no empty request DTO) — the
      compose harness or the Playwright CI job proves it; `dotnet test` does not.
- [ ] Tests handed to `dotnet-tdd`; scoped runs use `-- --filter-class "<FQN>"`
      (plain `--filter` is silently ignored — `rules/testing.md#running-tests`).
- [ ] `dotnet-review` suggested.
