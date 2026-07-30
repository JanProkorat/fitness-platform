---
description: FastEndpoints REPR rules for HTTP endpoints
---

# API Design Rules

All HTTP endpoints use FastEndpoints (REPR). Every endpoint is `internal sealed` and inherits `Endpoint<TRequest, TResponse>` or `EndpointWithoutRequest<TResponse>`.

## Endpoint pattern

Business logic in `HandleAsync`. No service classes, no MediatR. `DbContext` and other deps injected via the primary constructor. If `HandleAsync` grows beyond ~50 lines, extract `private` methods on the same class.

```csharp
internal sealed class GetOrderEndpoint(AppDbContext dbContext)
    : Endpoint<GetOrderRequest, GetOrderResponse>
{
    private readonly OrdersFeatureConfiguration _featureConfiguration = new();

    public override void Configure()
    {
        Get("orders/{id:guid}");
        Description(builder => builder.WithName(nameof(GetOrderEndpoint)).WithTag(_featureConfiguration));
        DontCatchExceptions();
        Policies(nameof(AuthorizationPolicies.UsersOnly));

        Summary(s =>
        {
            s.Summary = "Get order detail";
            s.Responses[StatusCodes.Status200OK] = "Order detail";
            s.Responses[StatusCodes.Status404NotFound] = "Order not found";
        });
    }

    public override async Task HandleAsync(GetOrderRequest req, CancellationToken ct)
    {
        var order = await dbContext.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == req.Id, ct);

        if (order is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(new GetOrderResponse(order.Id, order.Total), ct);
    }
}
```

## Configure structure

- HTTP verb + route first (`Get`, `Post`, `Put`, `Patch`, `Delete`).
- `Description(...)` always `.WithName(nameof(TheEndpoint))` + `.WithTag(_featureConfiguration)`.
- `DontCatchExceptions()` mandatory (#dont-catch-exceptions).
- `Policies(nameof(AuthorizationPolicies.XYZ))` (#authorization).
- `Summary` documents every response status used.

## Handleasync body

1. Input binding (FastEndpoints populates `req`).
2. Load data (`AsNoTracking()` for reads — rules/ef-core.md#asnotracking).
3. Guards for expected errors → `Send.XAsync(ct); return;` (rules/csharp-style.md#guard-clauses).
4. Business logic.
5. Success via `Send.OkAsync(...)` / `Send.CreatedAtAsync(...)` / `Send.NoContentAsync(...)`.

## Extract guards when many

When `HandleAsync` has **3 or more guard clauses** before the business logic, extract the load-and-validate sequence into a private helper named `Load{Entity}OrRespondAsync` (or `Load{Entity}IfAllowedAsync`). The helper returns `{Entity}?` — `null` signals that a response has already been written via `Send.XAsync(ct)`.

This keeps `HandleAsync` focused on the happy path; the helper is testable in isolation.

```csharp
public override async Task HandleAsync(PostScenarioResetRequest req, CancellationToken ct)
{
    var userId = HttpContext.TryGetUserIdClaimValue()!.Value;

    var planning = await LoadResettablePlanningAsync(req.PlanningId, userId, ct);
    if (planning is null)
    {
        return;
    }

    // ... business logic uses `planning` directly ...
}

private async Task<Planning?> LoadResettablePlanningAsync(PlanningId planningId, UserId userId, CancellationToken ct)
{
    var planning = await dbContext.Plannings
        .Include(p => p.Owner)
        .FirstOrDefaultAsync(p => p.Id == planningId, ct);

    if (planning is null)
    {
        await Send.NotFoundAsync(ct);
        return null;
    }

    if (planning.Owner?.UserId != userId)
    {
        AddError(r => r.Scope, ErrorCodes.Planning.OwnerRequired, ErrorCodes.Planning.OwnerRequired);
        await Send.ErrorsAsync(StatusCodes.Status403Forbidden, ct);
        return null;
    }

    if (planning.State == PlanningState.Completed)
    {
        AddError(r => r.Scope, ErrorCodes.Planning.AlreadyCompleted, ErrorCodes.Planning.AlreadyCompleted);
        await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
        return null;
    }

    return planning;
}
```

Anti-pattern: 4+ inline `if (...) { Send.X; return; }` blocks in `HandleAsync` followed by the real work. The reader cannot tell what the endpoint *does* without scrolling past the validation.

## Send pattern

```csharp
await Send.OkAsync(responseDto, ct);
await Send.CreatedAtAsync<GetOrderEndpoint>(new { id }, responseDto, cancellation: ct);
await Send.NoContentAsync(ct);
await Send.NotFoundAsync(ct);
await Send.ForbidAsync(ct);
await Send.UnauthorizedAsync(ct);
```

Anti-patterns: `return SendOkAsync(...)` (legacy pre-2.x), `return TypedResults.Ok(...)`, throwing for expected errors, manual `ProblemDetails`.

Always `return;` after `Send.XAsync(ct)` in a guard branch — response is already written.

## Feature configuration field

Every endpoint needs the feature configuration for Swagger tagging. Primary ctors cannot declare fields — place it on the class body as `private readonly OrdersFeatureConfiguration _featureConfiguration = new();`.

## Authorization

Always `nameof()`, never string literals: `Policies(nameof(AuthorizationPolicies.UsersOnly));`.

No endpoint is anonymous unless intentionally public (health check, welcome, OAuth callback) — then call `AllowAnonymous()` and document why in `Summary`.

## Routes

- Feature prefix: `orders/{id:guid}`, `timesheets/overview/{year:int}`.
- Lowercase + hyphens for multi-word: `license-assignments`.
- Constraints: `{id:guid}`, `{year:int}`.
- RESTful verbs: `GET` reads, `POST` creates, `PUT` full updates, `PATCH` partial, `DELETE` removal.

## Json serialization

Do not configure per endpoint — it is global.

## Dont catch exceptions

`DontCatchExceptions()` is mandatory on every endpoint.
