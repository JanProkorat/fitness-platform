using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.ClientTraining;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="CompleteWorkoutEndpoint"/>.
/// </summary>
public class CompleteWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly ILogger<CompleteWorkoutEndpoint> _logger =
        Substitute.For<ILogger<CompleteWorkoutEndpoint>>();

    // ── helpers ──────────────────────────────────────────────────────────────────

    private IPrDetectionService StubPrDetection()
    {
        var prDetection = Substitute.For<IPrDetectionService>();
        prDetection.DetectAndMarkPRsAsync(Arg.Any<WorkoutLog>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return prDetection;
    }

    private IApplicationDbContext EmptyDb() => new MockDbBuilder().Build();

    // ── existing behaviour ────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_ValidRequest_CompletesWorkout()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);

        var prDetection = StubPrDetection();
        var notifications = Substitute.For<INotificationService>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, EmptyDb(), prDetection, notifications, _logger);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await prDetection.Received(1).DetectAndMarkPRsAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, EmptyDb(), StubPrDetection(), Substitute.For<INotificationService>(), _logger);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── TrainingCompletion fan-out ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_CompletesWorkout_UpsertsTrainingCompletionWithAllSessionExerciseIds()
    {
        // Arrange
        var publicId = Guid.NewGuid(); // distinct from _clientId (the UserId)
        var sessionId = Guid.NewGuid();
        var exerciseA = Guid.NewGuid();
        var exerciseB = Guid.NewGuid();
        var startedAt = DateTime.UtcNow;

        // Build the training plan with a session containing exercise A and B.
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = publicId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Test Session",
                            Order = 1,
                            Exercises =
                            [
                                new SessionExercise
                                {
                                    ExerciseExternalId = exerciseA,
                                    ExerciseName = "Exercise A",
                                    Order = 1
                                },
                                new SessionExercise
                                {
                                    ExerciseExternalId = exerciseB,
                                    ExerciseName = "Exercise B",
                                    Order = 2
                                }
                            ]
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId,
            clientId: _clientId,
            planId: plan.ExternalId,
            sessionId: sessionId,
            startedAt: startedAt);

        // Mongo: workout logs + plan + empty completions (no existing doc).
        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            workoutLogs: [log]);

        // Also wire the WorkoutLogs collection for the initial find + replace.
        var logCollection = WorkoutLogTestHelpers.CreateMockLogCollection([log]);
        mongo.WorkoutLogs.Returns(logCollection);

        // DB: ClientProfile with UserId = _clientId and PublicId = publicId.
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = publicId })
            .Build();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, StubPrDetection(), Substitute.For<INotificationService>(), _logger);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert: primary contract — WorkoutLog.IsCompleted = true (the ReplaceOneAsync was called)
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await logCollection.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Is<WorkoutLog>(w => w.IsCompleted),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());

        // Assert: fan-out — TrainingCompletion inserted for (publicId, startedAt.Date, sessionId)
        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<TrainingCompletion>(c =>
                c.ClientId == publicId &&
                c.SessionId == sessionId &&
                c.Date == startedAt.Date &&
                c.CompletedExerciseIds.Count == 2 &&
                c.CompletedExerciseIds.Contains(exerciseA) &&
                c.CompletedExerciseIds.Contains(exerciseB) &&
                c.Version >= 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_IdempotentCompletion_LeavesExistingTrainingCompletionUnchanged()
    {
        // Arrange
        var publicId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseA = Guid.NewGuid();
        var exerciseB = Guid.NewGuid();
        var startedAt = DateTime.UtcNow;
        const int existingVersion = 3;

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = publicId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Test Session",
                            Order = 1,
                            Exercises =
                            [
                                new SessionExercise
                                {
                                    ExerciseExternalId = exerciseA,
                                    ExerciseName = "Exercise A",
                                    Order = 1
                                },
                                new SessionExercise
                                {
                                    ExerciseExternalId = exerciseB,
                                    ExerciseName = "Exercise B",
                                    Order = 2
                                }
                            ]
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId,
            clientId: _clientId,
            planId: plan.ExternalId,
            sessionId: sessionId,
            startedAt: startedAt);

        // Pre-existing completion doc with both exercises and version=3.
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: publicId,
            sessionId: sessionId,
            date: startedAt.Date,
            completedExerciseIds: [exerciseA, exerciseB],
            version: existingVersion);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion,
            workoutLogs: [log]);

        var logCollection = WorkoutLogTestHelpers.CreateMockLogCollection([log]);
        mongo.WorkoutLogs.Returns(logCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = publicId })
            .Build();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, StubPrDetection(), Substitute.For<INotificationService>(), _logger);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert: no insert or update on the completions collection (already complete).
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateDefinition<TrainingCompletion>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
        // Version on the in-memory doc is unchanged.
        existingCompletion.Version.Should().Be(existingVersion);
    }

    [Fact]
    public async Task HandleAsync_NoSessionId_SkipsFanOut()
    {
        // A log without a SessionId (ad-hoc workout) must not attempt completion fan-out.
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId,
            clientId: _clientId,
            sessionId: null);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo();
        var logCollection = WorkoutLogTestHelpers.CreateMockLogCollection([log]);
        mongo.WorkoutLogs.Returns(logCollection);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, StubPrDetection(), Substitute.For<INotificationService>(), _logger);

        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingCompletion>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
