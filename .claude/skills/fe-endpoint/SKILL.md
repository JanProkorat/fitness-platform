---
name: fe-endpoint
description: Scaffold a new FastEndpoints endpoint in the .NET backend — creates the Request / Response / Validator / Endpoint quartet under the correct feature folder plus a paired xUnit test file wired up with Testcontainers helpers. Invoke whenever a backend task says "add endpoint", "new API", "expose a route", or introduces a new HTTP verb under /backend.
---

# fe-endpoint — scaffold a FastEndpoints endpoint

Use this skill when you need to add a new HTTP endpoint to the backend. It
produces five files that match the house style so no bespoke boilerplate
slips in.

## Before you scaffold

Collect these from the task (ask the user if any are missing):

1. **Area** — the top-level feature folder, e.g. `NutritionPlans`,
   `Messaging`, `Trainers`, `Client`.
2. **Action** — the endpoint folder/class name in PascalCase imperative form,
   e.g. `ArchiveConversation`, `PublishWeek`, `SendInvite`.
3. **HTTP verb + route** — e.g. `POST /client/conversations/{id}/archive`.
   Follow existing prefixes:
   - `/client/...` for actions the client app calls
   - `/trainer/...` or `/<domain>/...` (role-gated) for trainer/nutritionist actions
   - `/auth/...` for authentication
4. **Auth requirement** — `AllowAnonymous`, role(s) (`AppRoles.Client`,
   `AppRoles.Trainer`, `AppRoles.Nutritionist`), or claim-based.
5. **Request / response shape** — minimal property list.
6. **Rate limit** — usually none; `AppPolicies.AuthRateLimit` for auth-ish
   endpoints.

## Files to create

Given `Area = NutritionPlans`, `Action = ArchivePlan`, `Verb = POST`,
`Route = /nutrition/plans/{planId}/archive`, `Role = AppRoles.Trainer`:

### 1. `backend/FitnessPlatform.Application/Features/<Area>/<Action>/<Action>Request.cs`

```csharp
namespace FitnessPlatform.Application.Features.NutritionPlans.ArchivePlan;

public class ArchivePlanRequest
{
    public Guid PlanId { get; set; }
    // add body properties here
}
```

### 2. `<Action>Response.cs`

```csharp
namespace FitnessPlatform.Application.Features.NutritionPlans.ArchivePlan;

public class ArchivePlanResponse
{
    public Guid PlanId { get; set; }
    public DateTime ArchivedAt { get; set; }
}
```

Skip the response file for endpoints that return `204 No Content`.

### 3. `<Action>Validator.cs`

```csharp
using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.ArchivePlan;

public class ArchivePlanValidator : Validator<ArchivePlanRequest>
{
    public ArchivePlanValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty();
    }
}
```

### 4. `<Action>Endpoint.cs`

```csharp
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;

namespace FitnessPlatform.Application.Features.NutritionPlans.ArchivePlan;

/// <summary>
/// Archives an active nutrition plan. Only the owning trainer/nutritionist
/// may call this.
/// </summary>
public class ArchivePlanEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db) : Endpoint<ArchivePlanRequest, ArchivePlanResponse>
{
    public override void Configure()
    {
        Post("/nutrition/plans/{planId}/archive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Archive a nutrition plan";
            s.Description = "Marks the plan as archived. Clients stop seeing it on Today.";
        });
    }

    public override async Task HandleAsync(ArchivePlanRequest req, CancellationToken ct)
    {
        // 1. Load (respect the Version field if writing to Mongo)
        // 2. Authorize — check the caller owns this resource
        // 3. Mutate + persist
        // 4. (Optional) broadcast via IRealtimeNotifier with a lowercase event name
        // 5. Send.OkAsync(new ArchivePlanResponse { ... }, ct)
        //
        // On failure: this.ThrowErrorWithCode(ErrorCodes.X, "message");
        throw new NotImplementedException();
    }
}
```

### 5. `backend/FitnessPlatform.Tests/Endpoints/<Area>/<Action>Tests.cs`

```csharp
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

public class ArchivePlanTests(EndpointFixture fixture) : EndpointTestBase(fixture)
{
    [Fact]
    public async Task Archive_WithValidPlan_Returns200()
    {
        // Arrange — use Builders + EndpointTestHelpers to seed data
        // Act — PostAsync to /nutrition/plans/{id}/archive
        // Assert — response shape + DB state
    }

    [Fact]
    public async Task Archive_ByNonOwner_Returns403()
    {
        // ensure IDOR protection
    }
}
```

Mirror the existing test layout in `FitnessPlatform.Tests/Endpoints/` — check a
neighbor (e.g. `Endpoints/NutritionPlans/PublishWeekEndpointTests.cs`) for the
exact fixture base class name and helpers used.

## After scaffolding

1. Fill in the handler logic.
2. If you added a new error code, add it to
   `Domain/Constants/ErrorCodes.cs`.
3. Build: `cd backend && dotnet build`.
4. Test: `cd backend && dotnet test --filter "FullName~<Action>"` (Docker must
   be running for Testcontainers).
5. If the request/response shape or route changed existing contracts, tell
   the orchestrator to run the `regen-api` skill for `/web` and `/mobile`
   before either client is updated.

## Related skills to chain

- **`gc-sec-review`** — run after scaffolding endpoints that touch auth,
  ownership, or abuse-prone surfaces (invites, password reset, file upload).
  It catches IDOR / injection / rate-limit gaps the template can't encode.
- **`engineering:testing-strategy`** — invoke when the endpoint has
  non-trivial state transitions or concurrency concerns; it helps decide
  which test cases beyond happy-path + authz-failure are worth writing.
- **`engineering:code-review`** — useful for a self-review pass before
  handing back, especially for endpoints that also broadcast SignalR events
  or mutate multiple aggregates.
- **`engineering:architecture`** — only when introducing a new cross-slice
  service or a novel concurrency/transaction pattern; write a short ADR
  so the decision isn't re-litigated later.

## Checklist before handing back

- [ ] Folder name, class names, and route all agree on the Action
- [ ] Auth: `AllowAnonymous`, `Roles(...)`, or explicit policy
- [ ] Validator covers required fields and reasonable length limits
- [ ] Handler uses Problem Details (`ThrowErrorWithCode`) for failures
- [ ] Mongo writes bump `Version`; reads compare it
- [ ] At least a happy-path test and an authz-failure test exist
- [ ] `dotnet build` passes
