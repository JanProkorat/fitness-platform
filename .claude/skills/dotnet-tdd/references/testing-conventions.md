# Testing Conventions (dotnet-tdd reference)

`rules/testing.md` is the source of truth for backend tests. This file only
names the concrete types a test file uses, so an agent can write one without
searching. Where the two disagree, the rule wins — fix this file.

## Test stack

One project, `backend/FitnessPlatform.Tests`: xUnit v3, FluentAssertions,
NSubstitute (+ `MockQueryable.NSubstitute`), `FastEndpoints.Testing`,
Testcontainers for PostgreSQL and MongoDB. No Moq, no FakeItEasy, no Respawn,
no separate unit/integration projects.

## File location

Mirror the feature path: `Features/{Area}/{Action}/` →
`FitnessPlatform.Tests/Endpoints/{Area}/{Action}EndpointTests.cs`. Validator
tests are `{Action}ValidatorTests.cs`, either beside them or under
`FitnessPlatform.Tests/Validators/` — match the area's existing tests.

## Collection attribute

Integration classes take `[Collection(TestCollection.Name)]` and inject
`FitnessApiFactory` through the primary constructor
(`Infrastructure/TestCollection.cs`, `Infrastructure/FitnessApiFactory.cs`).
Never build a `WebApplicationFactory` or a container per test class
(`rules/testing.md#containers-and-isolation`).

```csharp
[Collection(TestCollection.Name)]
public class CreateMilestoneEndpointTests(FitnessApiFactory factory)
{
    [Fact]
    public async Task CreateMilestone_LinkedClient_Returns201()
    {
        var ct = TestContext.Current.CancellationToken;
        var trainer = await TestActors.Trainer(factory).CreateAsync(ct);
        var client = await TestActors.Client(factory).CreateAsync(ct);
        await TestActors.Link(factory, trainer, client).CreateAsync(ct);

        var response = await trainer.Http.PostAsJsonAsync(/* route, body */, ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }
}
```

## Actors and data

- `Builders/TestActors.cs` — real users with a minted JWT; `actor.Http` is an
  authenticated `HttpClient`.
- `Builders/EntityBuilders.cs` (`EntityBuilder.ClientProfile`, …) — entities
  for unit tests.
- Unique data per test; filter list assertions to the test's own rows
  (`rules/testing.md#containers-and-isolation`).

## Endpoint unit tests

`Factory.Create<TEndpoint>(ctx => …, deps…)` with a mocked EF context from
`Builders/MockDbBuilder.cs` and claims from
`EndpointTestHelpers.FakeUserClaims(userId, AppRoles.X)`
(`Endpoints/EndpointTestHelpers.cs`). Link checks are stubbed with
`EndpointTestHelpers.CreateGrantingLinkAuthorizationService()` or an
NSubstitute stub returning `null`. Shipped example:
`Endpoints/ClientMeasurements/GetClientMeasurementsEndpointTests.cs`.

`Builders/MockMongoBuilder.cs` ignores query filters — a test that depends on
a Mongo filter needs a real container.

## Cancellation token

Pass `TestContext.Current.CancellationToken` to every async call.

## Time

Endpoints take `TimeProvider`; tests pass `TimeProvider.System`. There is no
fake clock in this repo — add one and document it if a test needs controlled
time (`rules/csharp-style.md#timeprovider`).

## Test ordering

| Case | Layer |
|---|---|
| Happy path + persisted state | Integration |
| 404 / 403 / 409 from the endpoint's own checks (ownership, link, state) | Endpoint unit, or integration when it depends on a real query |
| Each validator rule | Validator unit (`TestValidate`), asserting `ErrorCode` or `ErrorMessage` |
| "Validation is wired" | One 400 test per endpoint |
| No auth → 401, wrong role → 403 | **Not written** — the architecture test covers them (`rules/testing.md#authorization`) |
