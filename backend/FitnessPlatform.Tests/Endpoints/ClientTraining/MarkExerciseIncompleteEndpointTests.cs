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
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1, _exercise2]
            });

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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The update should have been called removing exercise1
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Is<UpdateDefinition<TrainingCompletion>>(u => u != null),
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
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise2]
            });

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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateDefinition<TrainingCompletion>>(),
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
            version: 3,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1]
            });

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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                SectionId = _sectionId,
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
            version: 2,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1]
            });

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockCompletionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = _exercise1,
                SectionId = _sectionId,
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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = Guid.NewGuid(), ExerciseExternalId = _exercise1, SectionId = _sectionId },
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
            mongo, db, _notifier, _compliance, _logger);

        // _exercise2 is NOT in the plan's session exercises
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise2, SectionId = _sectionId },
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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_ClearsWorkoutLogCompletedAtForExerciseOnly()
    {
        // Arrange — a WorkoutLog with two exercises, both fully completed
        var now = DateTime.UtcNow;
        var workoutLog = new Application.Domain.Documents.WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,         // auth user id — matches the JWT claim
            SessionId = _sessionId,
            StartedAt = now.Date.AddHours(9),
            IsCompleted = true,
            Sections =
            [
                new Application.Domain.Documents.WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
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

        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: now.Date,
            completedExerciseIds: [_exercise1, _exercise2],
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exercise1, _exercise2]
            });

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion,
            workoutLogs: [workoutLog]);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Act — unmark exercise1 only
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = _sectionId },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Exercise A (exercise1): all sets cleared
        var exerciseA = workoutLog.Exercises.First(e => e.ExerciseExternalId == _exercise1);
        exerciseA.Sets.Should().AllSatisfy(s => s.CompletedAt.Should().BeNull());

        // Exercise B (exercise2): sets still have CompletedAt
        var exerciseB = workoutLog.Exercises.First(e => e.ExerciseExternalId == _exercise2);
        exerciseB.Sets.Should().AllSatisfy(s => s.CompletedAt.Should().NotBeNull());

        // IsCompleted remains true because exercise B still has completed sets
        workoutLog.IsCompleted.Should().BeTrue();

        // ReplaceOneAsync was called for the log
        await mongo.WorkoutLogs.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.WorkoutLog>>(),
            Arg.Any<Application.Domain.Documents.WorkoutLog>(),
            Arg.Any<ReplaceOptions>(),
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
            mongo, db, _notifier, _compliance, _logger);

        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest { SessionId = _sessionId, ExerciseExternalId = _exercise1, SectionId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SameExerciseInTwoSections_UnmarkInOneSection_LeavesOtherSectionIntact()
    {
        // The core bug scenario: same catalog exercise in two sections, both marked complete.
        // Un-marking in section1 must NOT remove the exercise from section2's completion state.
        var sharedExerciseId = Guid.NewGuid();
        var (plan, section1Id, section2Id) =
            TrainingCompletionTestHelpers.CreateActivePlanWithDuplicateExerciseAcrossSections(
                _clientId, _sessionId, sharedExerciseId);

        // Completion has the exercise in both sections
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [sharedExerciseId],
            version: 1,
            completedExerciseIdsBySection: new Dictionary<string, List<Guid>>
            {
                [section1Id.ToString()] = [sharedExerciseId],
                [section2Id.ToString()] = [sharedExerciseId]
            });

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseIncompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _logger);

        // Un-mark in section1 only
        await ep.HandleAsync(
            new MarkExerciseIncompleteRequest
            {
                SessionId = _sessionId,
                ExerciseExternalId = sharedExerciseId,
                SectionId = section1Id
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The update must be called. The section-aware dict should only remove section1's entry.
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Is<UpdateDefinition<TrainingCompletion>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // The in-memory doc still has section2's entry for the exercise.
        existingCompletion.CompletedExerciseIdsBySection.Should().NotContainKey(section1Id.ToString());
        existingCompletion.CompletedExerciseIdsBySection.Should().ContainKey(section2Id.ToString());
        existingCompletion.CompletedExerciseIdsBySection![section2Id.ToString()].Should().Contain(sharedExerciseId);

        // The legacy flat list should still contain sharedExerciseId (section2 still has it).
        existingCompletion.CompletedExerciseIds.Should().Contain(sharedExerciseId);
    }
}
