using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for WodResult persistence at log root and per-exercise level
/// through <see cref="UpdateWorkoutEndpoint"/>.
/// </summary>
public class UpdateWorkoutLogWodResultTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private UpdateWorkoutEndpoint CreateEndpoint(IMongoContext mongo)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var notifier = Substitute.For<IRealtimeNotifier>();
        var logger = Substitute.For<ILogger<UpdateWorkoutEndpoint>>();

        return Factory.Create<UpdateWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, notifier, logger);
    }

    // ── Log-level WodResult ──────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_WithWodResultAtLogRoot_PersistsResult()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = new WodResult
            {
                RoundsCompleted = 7,
                ExtraReps = 4
            },
            Exercises = []
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Performance!.WodResult != null &&
                w.Performance!.WodResult.RoundsCompleted == 7 &&
                w.Performance!.WodResult.ExtraReps == 4),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithForTimeWodResult_PersistsTotalTimeSeconds()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = new WodResult
            {
                TotalTimeSeconds = 342
            },
            Exercises = []
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Performance!.WodResult != null &&
                w.Performance!.WodResult.TotalTimeSeconds == 342),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithTabataWodResult_PersistsRepsByRound()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var repsByRound = new List<int> { 8, 8, 8, 7, 8, 8, 6, 8 };

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = new WodResult
            {
                RoundsCompleted = 8,
                RepsByRound = repsByRound,
                FailedRounds = [4, 7]
            },
            Exercises = []
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Performance!.WodResult != null &&
                w.Performance!.WodResult.RoundsCompleted == 8 &&
                w.Performance!.WodResult.RepsByRound!.Count == 8 &&
                w.Performance!.WodResult.FailedRounds!.Contains(4) &&
                w.Performance!.WodResult.FailedRounds!.Contains(7)),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithNullWodResult_PersistsNull()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = null, // Standard workout — no WOD result
            Exercises = []
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w => w.Performance!.WodResult == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Per-exercise WodResult ───────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_WithWodResultPerExercise_PersistsExerciseResult()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = null,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Burpees",
                    WodResult = new WodResult
                    {
                        RoundsCompleted = 5,
                        ExtraReps = 12
                    },
                    Sets = []
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Exercises.Count == 1 &&
                w.Exercises[0].WodResult != null &&
                w.Exercises[0].WodResult!.RoundsCompleted == 5 &&
                w.Exercises[0].WodResult!.ExtraReps == 12),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithMixedExerciseWodResults_PersistsBothNullAndNonNull()
    {
        var logId = Guid.NewGuid();
        var exercise1Id = Guid.NewGuid();
        var exercise2Id = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = new WodResult { TotalTimeSeconds = 480 },
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exercise1Id,
                    ExerciseName = "Box Jumps",
                    WodResult = new WodResult { RoundsCompleted = 3, ExtraReps = 5 },
                    Sets = []
                },
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exercise2Id,
                    ExerciseName = "Deadlift",
                    WodResult = null, // Standard sets — no WOD result
                    Sets = []
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Performance!.WodResult != null &&
                w.Performance!.WodResult.TotalTimeSeconds == 480 &&
                w.Exercises[0].WodResult != null &&
                w.Exercises[0].WodResult!.RoundsCompleted == 3 &&
                w.Exercises[1].WodResult == null),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Old documents load without WodResult field ───────────────────────────

    [Fact]
    public async Task HandleAsync_OldLogWithoutWodResult_LoadsAndUpdatesCleanly()
    {
        // Simulate a log document saved before WodResult field was added.
        // WodResult will be null by C# property default on read.
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        // log.WodResult is null by default — simulates pre-migration document

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            WodResult = null,
            Exercises = []
        };

        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);
        await act.Should().NotThrowAsync();

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
