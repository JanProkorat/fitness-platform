---
paths:
  - "backend/**"
---

# Testing Rules (backend)

> **Descriptive.** Written in #1104 after the suite was cut from 15 min to
> ~1.5 min locally on the same 2528 tests, then trimmed to 2381. Applies to
> `backend/FitnessPlatform.Tests`. Every rule below exists because breaking it
> cost real minutes or hid a real bug.

## Time budget

CI fails the backend job when the three test chunks together take longer than
`TEST_TIME_BUDGET_SECONDS` (`.github/workflows/backend.yml`, step "Test suite
size and time budget"). The step also writes the test count and time to the
job summary. Count is reported, never limited — a useful test is always
welcome; a slow one is not.

Raising the budget needs a sentence in the PR saying what got slower and why
it can't be made cheaper. "The suite grew" is not a reason.

### Chunk layout

`build-and-test` runs the suite in three steps, one after another in the same
job. The budget covers all three together, so moving a class between chunks
saves nothing; only cheaper tests do.

| Chunk | Namespaces | Tests | CI time |
|---|---|---|---|
| 1 Endpoints | `Endpoints*` | 3130 | 110-140 s |
| 2 Services, Validators, Infrastructure | `Services*`, `Validators*`, `Infrastructure*` | 1029 | 31-36 s |
| 3 Remaining | everything else (complement of 1 and 2) | 487 | 51-63 s |

Measured on `develop` after #1768 (runs 40552071229, 40648936167 and
40763264376): 191 s, 224 s and 239 s against the 300 s budget, while the
suite grew from 4479 to 4646 tests. Runner variance is about ±30 s, almost
all of it in chunk 1. **Headroom is thin:** each feature epic adds tests to
chunks 1 and 3. The next lever is running independent collections in
parallel (#1805).

Where the time goes (local full run, #1563): chunk 1 has no slow class; its
1489 shared-database tests (`[Collection(TestCollection.Name)]`) take a
median of ~43 ms each. The big wins so far were whole-database work repeated
per test: `QaSeedRunnerTests` re-seeding (#1741) and `AutomationSchedulerTests`
sweeping every earlier test's rules (#1768). Look for that pattern first.

## What each layer is for

| Layer | Tool | Use for |
|---|---|---|
| Validator | `new XValidator().TestValidate(...)` | every input rule and boundary |
| Endpoint unit | `Factory.Create<TEndpoint>(...)` + mocks (`Builders/MockDbBuilder.cs`) | handler logic with dependencies stubbed |
| Integration | `[Collection(TestCollection.Name)]` + `FitnessApiFactory` | real DB, real pipeline, auth, ownership |
| Architecture | `Architecture/EndpointAuthorizationTests.cs` | rules that hold for every endpoint at once |

Test a behaviour at the cheapest layer that can prove it, and once.

## Authorization

- **Every endpoint declares `Roles(...)` or `AllowAnonymous()`** — enforced by
  `Architecture/EndpointAuthorizationTests.cs`. Its allow-list names the
  endpoints that deliberately require only a login; adding to it is a reviewed
  exception.
- **Don't add a per-endpoint "no auth → 401" or "wrong role → 403" test.** The
  architecture test covers every endpoint's declaration, including that
  allow-listed routes still require a login. The real pipeline is proven once
  by canaries: `DismissRequestEndpointTests.Dismiss_Unauthenticated_Returns401`
  and `PutSettingsEndpointTests.PutSettings_Unauthenticated_Returns401` for 401,
  `SessionTemplateRoleGateIntegrationTests` and
  `SubscriptionPlanRoleGateIntegrationTests` for wrong-role 403.
- Allow-listed endpoints keep their unit `HandleAsync_NoClaims_Returns401`
  tests — those test the endpoint's own missing-claim guard.
- **Do add a 403/404 test for every ownership, link or capability check** —
  that is app logic, not framework (`rules/api-design.md#authorization`).

## Validation

Rule-by-rule coverage lives in the validator's own tests. The endpoint gets
**one** 400 test proving validation is wired, not one per rule.

## Test data: small builders, not big setup

- Build actors with `Builders/TestActors.cs` (`TestActors.Trainer(factory).CreateAsync()`,
  `.Client(...)`, `TestActors.Link(factory, trainer, client)`) and entities with
  `Builders/EntityBuilders.cs`. They write straight to the database and mint a
  token (`Infrastructure/TestTokenFactory.cs`, kept honest by
  `TestTokenFactoryContractTests`).
- Real `/auth/register` and `/auth/login` belong in the Auth tests only.
- Create only what the test asserts on. No shared seed, no private per-file
  `Setup*Async` that builds a world.
- Don't copy a helper into another file — extend a builder.

## Containers and isolation

- Never start a container or a `WebApplicationFactory` per `[Fact]` — an
  instance field on the test class does exactly that, because xUnit builds a
  new class instance for each test. Use `ICollectionFixture<T>`.
- There is one Postgres and one Mongo container per run
  (`Infrastructure/SharedTestContainers.cs`, an assembly fixture). A fixture
  gets its own database inside them (`CreatePostgresDatabaseAsync`,
  `CreateMongoDatabaseName`).
- Isolate with unique data (fresh GUIDs, unique emails and names). A test that
  asserts an exact count or "contains a single" over a shared collection must
  clear that collection first (or `Infrastructure/DatabaseResetFixtureExtensions.cs`
  for a whole database) — otherwise it passes or fails by test order, which
  differs between machines (#1104's first CI run failed this way after three
  green local runs).
- **A list or search assertion must filter to the test's own data.** Hundreds
  of rows from other tests share the database; "my item is on page 1" passes
  or fails depending on test order (found in #1104,
  `ProfessionalAvatarIntegrationTests.SearchProfessionals_TrainerWithAvatar_ResponseContainsCorrectUrl`).

## Theories

One `[InlineData]` row per distinct branch or boundary. Five rows that hit the
same `Contains` check are one test written five times.

## Assertions

Assert the outcome. A test whose only assertion is `NotBeNull()` on the
response proves the call didn't throw — say that with `NotThrowAsync()`, or
check what actually changed.

## Waiting

No `Thread.Sleep` or fixed `Task.Delay` to wait for async work (background
services, SignalR, schedulers). Poll the observable outcome with a deadline
and fail with the last value seen.

## Cancellation token

Pass `TestContext.Current.CancellationToken` (xUnit v3) to every async call
in a test — the shipped norm, in 285 test files. It lets the runner cancel a
hung test instead of stalling the whole run.

## Running tests

- Scoped runs: `dotnet test backend/FitnessPlatform.Tests/FitnessPlatform.Tests.csproj -- --filter-class "<FQN>"`.
  Plain `--filter` is silently ignored and runs everything.
- Timing a full run: block sleep (`caffeinate -i`) and make sure no other test
  suite is running — both have produced numbers that were off by 10×.
- Per-test timings: add `--report-xunit --report-xunit-filename timing.xml`
  after the `--`.
