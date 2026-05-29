---
name: fe-endpoint
description: Scaffold a new FastEndpoints endpoint — Request / Response / Validator / Endpoint quartet plus xUnit + Testcontainers test. Invoke for "add endpoint", "new API", "expose a route" under /backend. TDD mode opt-in.
argument-hint: "<Feature> <HttpVerb> <Action> [TDD]"
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
4. Test: `cd backend && dotnet test -- --filter-class FitnessPlatform.Tests.Endpoints.<Folder>.<Action>EndpointTests`
   (Docker must be running for Testcontainers). The leading `--` forwards the
   option to Microsoft.Testing.Platform; the legacy VSTest
   `--filter "FullName~..."` syntax is silently ignored under MTP 1.9.x.
5. If the request/response shape or route changed existing contracts, tell
   the orchestrator to run the `regen-api` skill for `/web` and `/mobile`
   before either client is updated.

## TDD mode (opt-in)

When the orchestrator's prompt contains the word **"TDD"** or the
phrase **"test-first"**, switch to red-green-refactor discipline.
This is slower but tighter — every test is written from the AC, runs
RED first, then minimal code makes it GREEN.

### Iron law

The integration test must run, **fail with a meaningful error**, and
have its failure observed BEFORE the endpoint implementation exists.
A passing test against a stub doesn't prove anything.

### Steps in TDD mode

1. **Read `approved_scope.error_paths`** from
   `state/handoff-design-<issue>.json`. Each entry becomes one
   integration test (one `[Fact]` per status code / scenario).
2. **Write the integration test FIRST**: HTTP-level via
   `WebApplicationFactory<TestStartup>` + Testcontainers. Use the
   shared `IntegrationTestFixture` and the existing
   `ITestUser`/`AuthenticatedHttpClient` helpers. Reference exactly
   ONE existing endpoint test as exemplar (see Read-ONE-exemplar
   in §read-one-exemplar — the patterns are consistent).
3. **Run the test**: `dotnet test -- --filter-class FitnessPlatform.Tests.Endpoints.<Folder>.<Action>EndpointTests`
   — it MUST fail. Confirm the failure mode is what you expect (404
   on missing endpoint, not a compilation error). If the test passes
   against an empty endpoint, the test is wrong — broaden it. (The
   legacy VSTest `--filter "FullName~..."` syntax is silently ignored
   under MTP 1.9.x — see `rules/verification.md`.)
4. **Scaffold the Request / Response / Validator / Endpoint** (the
   non-TDD steps above) with **minimal logic** to make the test
   pass. Don't gold-plate. No extra error paths, no extra fields.
5. **Run again**: GREEN.
6. **Refactor**: extract helpers, tidy naming, add XML doc-comments.
   Re-run the test after each refactor.
7. **Repeat for the next error path**: write next failing test,
   make it green, refactor. One AC per cycle.

### Don't, in TDD mode

- Don't write the endpoint first and then add tests against it. The
  whole point is the test-first failure proves the test exercises
  the right path.
- Don't write 5 tests upfront. One per RED-GREEN cycle.
- Don't merge a test that doesn't have an observed failure history.
  If the orchestrator dispatched in TDD mode, the dev-handoff JSON
  should include a brief "RED → GREEN" note per test in `tests_added`.

### When to skip TDD mode

If the orchestrator dispatched WITHOUT "TDD" in the prompt, fall
through to the regular After-scaffolding flow. TDD mode is opt-in;
the default (ad-hoc tests after implementation) is still acceptable
for routine endpoints with simple AC.

## Read-ONE-exemplar

When choosing an exemplar to model from, read **exactly ONE existing
endpoint** in the same feature folder (or the closest analogue if the
folder is new). The project's vertical-slice patterns are consistent
enough that one is sufficient.

Fall back to a second exemplar ONLY if the first is incomplete (e.g.
it doesn't cover the auth/role pattern you need). **Never read more
than two**. Inline reads pollute the agent's context with files it'll
forget; if you genuinely need broader research, dispatch an Explore
sub-agent with `model: "haiku"` instead.

## Related skills to chain

- **`testcontainers:testcontainers-dotnet`** — Testcontainers for .NET
  4.10+ fixture patterns. Invoke when step 5 needs a container the
  existing `EndpointFixture` / `IntegrationTestFixture` doesn't cover
  (new DB engine, non-default Postgres/Mongo version, S3 mock outside
  MinIO); returns canonical `Container.Builder()` / `WaitUntil` recipes.
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
