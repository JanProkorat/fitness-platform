using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkExerciseIncompleteEndpoint"/>.
/// </summary>
public class MarkExerciseIncompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly IClientLinkAuthorizationService _linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
    private readonly ILogger<MarkExerciseIncompleteEndpoint> _logger = Substitute.For<ILogger<MarkExerciseIncompleteEndpoint>>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_CompleteExerciseThenUncomplete_Returns200AndExerciseGone()
    {
        // Set up: exercise1 is already marked complete
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1, _exercise2],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The update should have been called removing exercise1
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<UpdateDefinition<SessionExecution>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyIncomplete_IsIdempotent_Returns200()
    {
        // exercise1 is NOT in the section completed list — idempotent path
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise2],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_StaleVersionPreCheck_Returns409WithVersionConflictCode()
    {
        // Completion document is at version 3; client sends version 1 (stale)
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 3);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = _exercise1,
                Version = 1  // client thinks it's version 1, server is at 3
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_StaleVersionOnUpdate_Returns409WithVersionConflictCode()
    {
        // Completion is at version 2; client matches — but UpdateOneAsync returns ModifiedCount=0 (race)
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 2);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = _exercise1,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_WrongClient_Returns404()
    {
        // No active plan found for the wrong client
        var wrongClientId = Guid.NewGuid();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: null);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = wrongClientId, PublicId = wrongClientId })
            .Build();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(wrongClientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        // No active plan → 404 with NoActiveTrainingPlan code
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NonExistentSessionId_Returns404WithTrainingSessionNotFoundCode()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = Guid.NewGuid(), ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NonExistentExerciseId_Returns404WithTrainingExerciseNotFoundCode()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        // _exercise2 is NOT in the plan's session exercises
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise2 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// #841: the endpoint no longer syncs a separate WorkoutLog document — the set-by-set
    /// Performance data lives on the SAME SessionExecution as the checkbox completion flags.
    /// Un-marking an exercise clears its Performance sets' CompletedAt in-place on the loaded
    /// document (mutated before the versioned UpdateOneAsync call), no cross-collection write.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ClearsPerformanceCompletedAtForExerciseOnly()
    {
        // Arrange — a single SessionExecution carrying BOTH the checkbox flags AND Performance
        // (set-by-set) data for two fully-completed exercises.
        var now = DateTime.UtcNow;
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: now.Date,
            completedExerciseIds: [_exercise1, _exercise2],
            version: 1);
        existingCompletion.Performance = new SessionExecutionPerformance
        {
            StartedAt = now.Date.AddHours(9),
            CompletedAt = now,
            Workouts =
            [
                new Application.Domain.Documents.LoggedWorkout
                {
                    WorkoutId = _sectionId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new Application.Domain.Documents.WorkoutExercise
                        {
                            ExerciseExternalId = _exercise1,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new Application.Domain.Documents.WorkoutSet { SetNumber = 1, Reps = 5, WeightKg = 100m, CompletedAt = now },
                                new Application.Domain.Documents.WorkoutSet { SetNumber = 2, Reps = 5, WeightKg = 100m, CompletedAt = now }
                            ]
                        },
                        new Application.Domain.Documents.WorkoutExercise
                        {
                            ExerciseExternalId = _exercise2,
                            ExerciseName = "Deadlift",
                            Sets =
                            [
                                new Application.Domain.Documents.WorkoutSet { SetNumber = 1, Reps = 3, WeightKg = 140m, CompletedAt = now }
                            ]
                        }
                    ]
                }
            ]
        };

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        // Act — unmark exercise1 only
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Exercise A (exercise1): all sets cleared, mutated in-place on the same document the
        // mock's FindAsync returned.
        var exerciseA = existingCompletion.Performance.Exercises.First(e => e.ExerciseExternalId == _exercise1);
        exerciseA.Sets.Should().AllSatisfy(s => s.CompletedAt.Should().BeNull());

        // Exercise B (exercise2): sets still have CompletedAt
        var exerciseB = existingCompletion.Performance.Exercises.First(e => e.ExerciseExternalId == _exercise2);
        exerciseB.Sets.Should().AllSatisfy(s => s.CompletedAt.Should().NotBeNull());

        // UpdateOneAsync was called for the unified SessionExecutions collection — no separate
        // WorkoutLogs write.
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_UnknownSectionId_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        // #857 phase 3b: an unknown exercise INSTANCE id (no such id in the section — the
        // pre-3b "unknown section" concept no longer exists once ExerciseId is the sole
        // disambiguator) must still 404.
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SameExerciseInTwoSections_UnmarkInOneSection_LeavesOtherSectionIntact()
    {
        // The core bug scenario: same catalog exercise in two workouts, both instances marked
        // complete. Un-marking the section1 instance (by its distinct ExerciseId) must NOT clear
        // the section2 instance's completion state, even though both share the same catalog
        // ExerciseExternalId.
        var sharedExerciseId = Guid.NewGuid();
        var (plan, _, _, workout1ExerciseId, workout2ExerciseId) =
            TrainingCompletionTestHelpers.CreateActivePlanWithDuplicateExerciseAcrossSections(
                _clientId, _sessionId, sharedExerciseId);

        // Completion has both instances complete
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [workout1ExerciseId, workout2ExerciseId],
            version: 1);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _linkAuthorizationService, _logger, TimeProvider.System);

        // Un-mark the section1 instance only
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = workout1ExerciseId
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The update must be called.
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<UpdateDefinition<SessionExecution>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Only the section1 instance was removed — the session still has 2 exercise instances
        // total (both workouts' occurrences of the shared catalog exercise), and exactly 1
        // (the section2 instance) remains complete.
        ep.Response.TotalExerciseCount.Should().Be(2);
        ep.Response.CompletedExerciseCount.Should().Be(1);
    }
}
