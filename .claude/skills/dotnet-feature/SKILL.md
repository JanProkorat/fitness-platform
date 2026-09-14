---
name: dotnet-feature
description: Scaffold a .NET vertical slice — endpoint, request/response, validator, errors, IFeatureConfiguration, test stub. Use when adding a new endpoint, command, query, CRUD op, API route, or Features/{Name}/ folder.
argument-hint: "<FeatureName> <Action> <description>"
---

# Feature Scaffolding

**Arguments:** `$ARGUMENTS` — e.g., `Absences Create "Create a new employee absence"`.

## When to use
- New endpoint / command / query / CRUD operation in a FastEndpoints + vertical slice project.
- Adding a `Features/{Name}/` folder.

## When not to use
- Migration generation → `/dotnet-migrate`.
- Post-implementation convention check → `/dotnet-review`.
- Test-first flow → `/dotnet-tdd`.

## Required rules

Load these at invocation — they define every convention enforced while scaffolding:

- `rules/architecture.md` — vertical-slice layout, feature configuration, banned patterns.
- `rules/api-design.md` — FastEndpoints REPR, `Configure()` structure, `Send.*` pattern.
- `rules/validation.md` — when to add a validator, error-code pattern.
- `rules/error-handling.md` — `Send.*Async(ct)` for expected errors; no exceptions for control flow.
- `rules/naming.md` — file/type, endpoint/request/response/validator, error-code naming.
- `rules/csharp-style.md` — records for DTOs, primary constructors, XML docs, `Guid`/`TimeProvider`.
- `rules/ef-core.md` — `DbContext` injection (consulted only if the scaffold touches EF).

## Steps

1. **Clarify only if missing.** Proceed with `$ARGUMENTS`. Ask only for route, request fields, or business errors you can't infer. Record assumptions in `HANDOFF.md`.
2. **Read exactly one exemplar** of the same kind:
   - Command: `Features/{Feature}/Commands/Update/`
   - Query: `Features/{Feature}/Queries/Detail/`
   - Entity + EF config: `Database/Entities/{Entity}Do.cs` and its matching configuration. If repo uses `[Table]` + `[MaxLength]` annotations, follow that — don't introduce a configuration class.
   - If named exemplar missing: one `Glob` for `**/Commands/**/*Endpoint.cs` (or Queries), read the first match.
3. **Write in this order** (compile never blocks): `Request` → `Validator` → `FeatureConfiguration` (if new) → `Endpoint` → integration test class.
4. **New DB entity?** Add `{Entity}Do : AuditableDo`, register `DbSet<{Entity}Do>`, then write `HANDOFF.md` dispatching `/dotnet-migrate`. Do not scaffold the migration yourself.
5. **Test stub:** Use `/dotnet-tdd` for testing
6. Suggest `/dotnet-review` before commit.

## Folder layout

```
Features/{Feature}/
├── {Feature}FeatureConfiguration.cs   # create iff folder has none
├── Utils/ErrorCodes.cs                # extend (error code constants, used with AddError)
├── Shared/{Entity}Dto.cs              # only if 2+ endpoints share the shape
└── Commands/{Action}/   (or Queries/{Action}/ for GET)
    ├── {Action}{Entity}Endpoint.cs
    ├── {Action}{Entity}Request.cs     # skip only for EndpointWithoutRequest
    └── {Action}{Entity}Validator.cs   # skip if 0–1 shape rules
```

## Canonical skeletons

### Feature configuration

```csharp
/// <summary>Feature configuration for {feature}.</summary>
[ExcludeFromCodeCoverage]
internal sealed class {Feature}FeatureConfiguration : IFeatureConfiguration
{
    /// <summary>Swagger tag info for this feature.</summary>
    public FeatureInfo Info => new("{Feature}", "{short description}");

    /// <summary>Register feature-scoped services here.</summary>
    public IServiceCollection AddFeatureDependencies(IServiceCollection services, IConfiguration configuration)
        => services;
}
```

### Request (mutable class, `required` on non-nullable)

```csharp
/// <summary>Request for {action} {entity}.</summary>
public sealed class {Action}{Entity}Request
{
    public required Guid Id { get; init; }           // route param
    public required string Title { get; set; }       // body field
    public string? Note { get; set; }                // nullable body field
}
```

### Validator (every rule has `.WithErrorCode(...)`)

```csharp
internal sealed class {Action}{Entity}Validator : Validator<{Action}{Entity}Request>
{
    public {Action}{Entity}Validator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithErrorCode(ErrorCodes.Validation.Required);
        RuleFor(x => x.Note)
            .MaximumLength(500).WithErrorCode(ErrorCodes.Validation.TooLong);
    }
}
```

### Endpoint (Command — linear guards)

```csharp
/// <summary>{Action} {entity} endpoint.</summary>
internal sealed class {Action}{Entity}Endpoint({DbContext} dbContext)  // DbContext class name from CLAUDE.md → AppDbContext
    : Endpoint<{Action}{Entity}Request, {Action}{Entity}Response>
{
    private readonly {Feature}FeatureConfiguration _featureConfiguration = new();

    public override void Configure()
    {
        Post("api/{feature}");
        Description(b => b.WithName(nameof({Action}{Entity}Endpoint)).WithTag(_featureConfiguration));
        DontCatchExceptions();
        Policies(nameof(AuthorizationPolicies.{Feature}Write));
    }

    public override async Task HandleAsync(
        {Action}{Entity}Request req, CancellationToken ct)
    {
        var entity = new {Entity}Do { /* map req */ };
        dbContext.{Entities}.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await Send.CreatedAtAsync<{Action}{Entity}Endpoint>(new { entity.Id }, new {Action}{Entity}Response(entity.Id), cancellation: ct);
    }
}
```

For guard branches: `if (entity is null) { await Send.NotFoundAsync(ct); return; }` per `error-handling.md#send-for-expected-errors`. Use `AddError(...) + Send.ErrorsAsync(ct)` when a structured error code/message is needed in the 400/409 body.

### Endpoint (Query)

```csharp
public override async Task HandleAsync(
    {Query}Request req, CancellationToken ct)
{
    var dto = await dbContext.{Entities}
        .AsNoTracking()
        .Where(x => x.Id == req.Id)
        .Select(x => new {Entity}Dto { Id = x.Id, Title = x.Title })
        .FirstOrDefaultAsync(ct);

    if (dto is null)
    {
        await Send.NotFoundAsync(ct);
        return;
    }

    await Send.OkAsync(dto, ct);
}
```

### DTO (record with `init`)

```csharp
public sealed record {Entity}Dto
{
    public required Guid Id { get; init; }
    public required string Title { get; init; }
}
```

### Integration test stub

```csharp
[Collection(TestConstants.Collections.{Feature}Test)]
public sealed class {Action}{Entity}EndpointTests(IntegrationTestFixture app) : TestBase
{
    protected override async ValueTask SetupAsync() => await app.ResetDatabaseAsync(); 

    [Fact] public async Task HandleAsync_Unauthorized_Returns401() { /* clear auth headers */ }
    [Fact] public async Task HandleAsync_InsufficientPermission_Returns403() { /* user with wrong role */ }
    [Fact] public async Task HandleAsync_ValidRequest_ReturnsCreated()
    {
        // for commands: assert DB state via app.Services.CreateScope()
    }
}
```

## Non-negotiables

- YES: `internal sealed` on Endpoint, Validator, FeatureConfiguration, EF Configuration
- YES: `DontCatchExceptions()` and `Permissions(...)` in every `Configure()`
- YES: `.WithName(nameof(...))` + `.WithTag(_featureConfiguration)`
- YES: `CancellationToken ct` forwarded on every async call
- YES: queries use `AsNoTracking()` + `Select()` projection
- YES: `required` on non-nullable request fields
- YES: XML `/// <summary>` on public/internal members
- YES: `Guid` keys; `TimeProvider` for dates; file-scoped namespaces; one type per file

## Don't

- Don't construct `Error.NotFound(...)` inline in endpoints — use `{Feature}Errors` factory.
- Don't cross feature namespaces; extract to `Shared/` or `Common/`.
- Don't skip the "Required rules" load step — nothing under `rules/` loads itself.
- Don't scaffold migrations yourself — hand off to `/dotnet-migrate`.
- Don't skip `DontCatchExceptions()` — silent 401s follow.

## Escalation

- DB write + external side effect (email, Graph, Excel) → ROP chain with side-effect as `Tap`.
- Bulk ops / file uploads → ask about validation strategy (base64 vs multipart vs streaming) before scaffolding.

## Done when

- [ ] Feature folder matches layout above; one type per file.
- [ ] `{Feature}FeatureConfiguration.cs` exists (endpoint visible in Swagger).
- [ ] Endpoint, Request, Validator, Errors, FeatureConfiguration compile: `dotnet build`.
- [ ] Integration test class has 401 / 403 / happy-path tests minimum.
- [ ] `dotnet test --filter "FullyQualifiedName~{Action}{Entity}EndpointTests"` runs (may still be red if behaviour not yet implemented).
- [ ] `/dotnet-review` suggested to user.
