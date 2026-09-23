using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.SessionTemplates.CopySessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.DeleteSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.GetSessionTemplate;
using FitnessPlatform.Application.Features.SessionTemplates.SaveSessionTemplateFromPlan;
using FitnessPlatform.Application.Features.SessionTemplates.SearchSessionTemplates;
using FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.SessionTemplates;

/// <summary>
/// Thin per-collection handle onto the shared Mongo container (#1104 Phase B — see
/// <see cref="SharedTestContainers"/>). Each collection using this fixture gets its own
/// database name inside that one shared server instead of its own container.
/// </summary>
public class SessionTemplateMongoContainerFixture(SharedTestContainers sharedContainers)
{
    public string ConnectionString => sharedContainers.MongoConnectionString;

    public string DatabaseName { get; } = SharedTestContainers.CreateMongoDatabaseName("sessiontemplate");
}

[CollectionDefinition("SessionTemplateEndpoint")]
public class SessionTemplateEndpointCollection : ICollectionFixture<SessionTemplateMongoContainerFixture>;

/// <summary>
/// Testcontainers integration tests for the SessionTemplate sharing-library feature (#860) —
/// visibility matrix across all three guard classes (read-guarded reads, read-guarded write
/// (<c>copy</c>), write-guarded mutations), the PUT/DELETE ownership + version-CAS paths
/// (including the stale-version-against-Private-entry 404 pin), the from-plan copy path, and
/// search. Mirrors the Testcontainers pattern used by <c>MealTemplateEndpointTests</c> (#859)
/// rather than NSubstitute-mocked collections, because the loaders and the search helper
/// exercise real MongoDB filter/sort semantics that a mock cannot faithfully reproduce.
/// </summary>
/// <remarks>
/// Unique <c>Guid.NewGuid()</c> external ids per fact are NOT sufficient isolation here
/// (unlike the sibling classes converted in #1104): the search endpoint under test matches
/// "own template at any visibility OR ANY owner's Public template", so a Public-visibility
/// document seeded by an earlier fact stays a permanent match for every later fact's search
/// once the Mongo container is shared across the whole class. Each fact drops both
/// collections in its own <see cref="IAsyncLifetime.InitializeAsync"/> to restore the
/// empty-collection starting point every per-test-boot fact used to get for free.
/// </remarks>
[Collection("SessionTemplateEndpoint")]
public class SessionTemplateEndpointTests : IAsyncLifetime
{
    private readonly PlanConcurrencyGuard _guard = new();

    private readonly IMongoContext _mongoContext;
    private readonly IMongoCollection<SessionTemplate> _templates;
    private readonly IMongoCollection<TrainingPlan> _plans;

    public SessionTemplateEndpointTests(SessionTemplateMongoContainerFixture containerFixture)
    {
        var mongoClient = new MongoClient(containerFixture.ConnectionString);
        var database = mongoClient.GetDatabase(containerFixture.DatabaseName);
        _templates = database.GetCollection<SessionTemplate>("sessionTemplates");
        _plans = database.GetCollection<TrainingPlan>("trainingPlans");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.SessionTemplates.Returns(_templates);
        mongoContext.TrainingPlans.Returns(_plans);
        _mongoContext = mongoContext;
    }

    public async ValueTask InitializeAsync()
    {
        await _templates.DeleteManyAsync(FilterDefinition<SessionTemplate>.Empty);
        await _plans.DeleteManyAsync(FilterDefinition<TrainingPlan>.Empty);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    // ── helpers ─────────────────────────────────────────────────────────────

    private static TEndpoint CreateEndpoint<TEndpoint>(Guid userId, params object[] dependencies)
        where TEndpoint : class, IEndpoint =>
        Factory.Create<TEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer))),
            dependencies);

    private async Task<SessionTemplate> InsertTemplateAsync(
        Guid ownerId,
        LibraryVisibility visibility = LibraryVisibility.Private,
        string name = "Test Template",
        int version = 1)
    {
        var template = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Difficulty = ExerciseDifficulty.Intermediate,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = Guid.NewGuid(),
                            ExerciseName = "Back Squat",
                            Order = 1
                        }
                    ]
                }
            ],
            Visibility = visibility,
            DateCreated = DateTime.UtcNow,
            Version = version
        };

        await _templates.InsertOneAsync(template, cancellationToken: TestContext.Current.CancellationToken);
        return template;
    }

    private async Task<SessionTemplate?> FindByExternalIdAsync(Guid externalId)
    {
        var cursor = await _templates.FindAsync(
            Builders<SessionTemplate>.Filter.Eq(t => t.ExternalId, externalId),
            cancellationToken: TestContext.Current.CancellationToken);
        return await cursor.FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    // ── GetSessionTemplate — read-guarded read, visibility matrix ─────────────

    [Fact]
    public async Task GetSessionTemplate_OwnPrivate_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<GetSessionTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new GetSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetSessionTemplate_OwnPublic_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<GetSessionTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new GetSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetSessionTemplate_OtherOwnersPublic_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<GetSessionTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetSessionTemplate_OtherOwnersPrivate_Returns404NotFound()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<GetSessionTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetSessionTemplate_MissingTemplate_Returns404IdenticalToDeniedPrivate()
    {
        var callerId = Guid.NewGuid();

        var ep = CreateEndpoint<GetSessionTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetSessionTemplateRequest { TemplateId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── SearchSessionTemplates — visibility filter ────────────────────────────

    [Fact]
    public async Task SearchSessionTemplates_ReturnsOwnAtAnyVisibilityPlusOthersPublic_NeverOthersPrivate()
    {
        var callerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();

        var ownPrivate = await InsertTemplateAsync(callerId, LibraryVisibility.Private, "Own Private");
        var ownPublic = await InsertTemplateAsync(callerId, LibraryVisibility.Public, "Own Public");
        var othersPublic = await InsertTemplateAsync(otherId, LibraryVisibility.Public, "Others Public");
        await InsertTemplateAsync(otherId, LibraryVisibility.Private, "Others Private");

        var ep = CreateEndpoint<SearchSessionTemplatesEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new SearchSessionTemplatesRequest { Page = 1, PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Templates.Select(t => t.TemplateId).Should().BeEquivalentTo(
            [ownPrivate.ExternalId, ownPublic.ExternalId, othersPublic.ExternalId]);
    }

    // ── UpdateSessionTemplate — ownership + Version CAS ───────────────────────

    [Fact]
    public async Task UpdateSessionTemplate_Owner_UpdatesAndBumpsVersion()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId);

        var ep = CreateEndpoint<UpdateSessionTemplateEndpoint>(
            ownerId, _mongoContext, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateSessionTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Renamed",
            Difficulty = ExerciseDifficulty.Advanced,
            Workouts = template.Workouts,
            Visibility = LibraryVisibility.Public,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Name.Should().Be("Renamed");
        ep.Response.Version.Should().Be(2);

        var persisted = await FindByExternalIdAsync(template.ExternalId);
        persisted!.Name.Should().Be("Renamed");
        persisted.Visibility.Should().Be(LibraryVisibility.Public);
    }

    [Fact]
    public async Task UpdateSessionTemplate_OwnerStaleVersion_Returns409()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, version: 1);

        var ep = CreateEndpoint<UpdateSessionTemplateEndpoint>(
            ownerId, _mongoContext, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateSessionTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Renamed",
            Workouts = template.Workouts,
            Version = 999
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task UpdateSessionTemplate_OtherOwnersPublic_Returns403NotOwned()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<UpdateSessionTemplateEndpoint>(
            callerId, _mongoContext, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateSessionTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Hijacked",
            Workouts = template.Workouts,
            Version = template.Version
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    /// <summary>
    /// The property this test exists to pin: a stale version against another owner's Private
    /// entry must still return 404 (denial-before-version-check), never 409 — a 409 here would
    /// disclose the entry's existence to a caller with no read right to it at all.
    /// </summary>
    [Fact]
    public async Task UpdateSessionTemplate_OtherOwnersPrivateWithStaleVersion_Returns404NotVersionConflict()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private, version: 1);

        var ep = CreateEndpoint<UpdateSessionTemplateEndpoint>(
            callerId, _mongoContext, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateSessionTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Hijacked",
            Workouts = template.Workouts,
            Version = 999 // deliberately stale/wrong
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── DeleteSessionTemplate — write-guarded, hard delete ────────────────────

    [Fact]
    public async Task DeleteSessionTemplate_Owner_RemovesDocumentAndReturns204()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId);

        var ep = CreateEndpoint<DeleteSessionTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new DeleteSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        (await FindByExternalIdAsync(template.ExternalId)).Should().BeNull();
    }

    [Fact]
    public async Task DeleteSessionTemplate_OtherOwnersPublic_Returns403AndDoesNotDelete()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<DeleteSessionTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new DeleteSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
        (await FindByExternalIdAsync(template.ExternalId)).Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteSessionTemplate_OtherOwnersPrivate_Returns404()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<DeleteSessionTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new DeleteSessionTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── CopySessionTemplate — read-guarded WRITE ──────────────────────────────

    [Fact]
    public async Task CopySessionTemplate_OtherOwnersPrivate_Returns404()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<CopySessionTemplateEndpoint>(callerId, _mongoContext, TimeProvider.System);
        await ep.HandleAsync(new CopySessionTemplateRequest { TemplateId = source.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── SaveSessionTemplateFromPlan ────────────────────────────────────────────

    private async Task<(TrainingPlan Plan, TrainingSession Session)> InsertPlanWithSessionAsync(Guid trainerId)
    {
        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Push Day",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = Guid.NewGuid(),
                            ExerciseName = "Bench Press",
                            Order = 1
                        }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            TrainerId = trainerId,
            ClientId = Guid.NewGuid(),
            Name = "Test Plan",
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new TrainingDay { DayOfWeek = 1, Sessions = [session] }
                    ]
                }
            ]
        };

        await _plans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        return (plan, session);
    }

    [Fact]
    public async Task SaveSessionTemplateFromPlan_PlanNotOwnedByCaller_Returns404()
    {
        var actualOwnerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var (plan, session) = await InsertPlanWithSessionAsync(actualOwnerId);

        var ep = CreateEndpoint<SaveSessionTemplateFromPlanEndpoint>(
            callerId, _mongoContext, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveSessionTemplateFromPlanRequest
        {
            PlanId = plan.ExternalId,
            WeekNumber = 1,
            DayOfWeek = 1,
            SessionId = session.SessionId,
            Name = "Stolen"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SaveSessionTemplateFromPlan_MissingPlan_Returns404()
    {
        var trainerId = Guid.NewGuid();

        var ep = CreateEndpoint<SaveSessionTemplateFromPlanEndpoint>(
            trainerId, _mongoContext, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveSessionTemplateFromPlanRequest
        {
            PlanId = Guid.NewGuid(),
            WeekNumber = 1,
            DayOfWeek = 1,
            SessionId = Guid.NewGuid(),
            Name = "Ghost"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SaveSessionTemplateFromPlan_UnknownSessionId_Returns404()
    {
        var trainerId = Guid.NewGuid();
        var (plan, _) = await InsertPlanWithSessionAsync(trainerId);

        var ep = CreateEndpoint<SaveSessionTemplateFromPlanEndpoint>(
            trainerId, _mongoContext, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveSessionTemplateFromPlanRequest
        {
            PlanId = plan.ExternalId,
            WeekNumber = 1,
            DayOfWeek = 1,
            SessionId = Guid.NewGuid(), // not in the addressed day
            Name = "Wrong session"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
