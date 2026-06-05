using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.UpdateWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for snapshot-planned field persistence in <see cref="UpdateWorkoutEndpoint"/>.
/// Covers:
/// — planned fields are forwarded from request onto WorkoutSet (happy path)
/// — IsModified computed property reflects actual-vs-planned differences
/// — backward-compatible: omitting planned fields does not break existing behaviour
/// </summary>
public class UpdateWorkoutPlannedSnapshotTests
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

    // ── Happy path: planned values are persisted alongside actuals ─────────────

    [Fact]
    public async Task HandleAsync_WithPlannedFields_PersistsSnapshotOnWorkoutSet()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Squat",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 8,                 // actual: slightly fewer than prescribed
                            WeightKg = 100m,
                            Rpe = 8m,
                            PlannedReps = 10,         // snapshot-planned
                            PlannedWeightKg = 100m,
                            PlannedRpe = 7m
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Verify planned fields are written to the document.
        await mongo.WorkoutLogs.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Is<WorkoutLog>(w =>
                w.Exercises[0].Sets[0].PlannedReps == 10 &&
                w.Exercises[0].Sets[0].PlannedWeightKg == 100m &&
                w.Exercises[0].Sets[0].PlannedRpe == 7m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithAllFivePlannedFields_PersistsAll()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Run",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            DurationSeconds = 120,
                            DistanceMeters = 500m,
                            PlannedReps = null,
                            PlannedWeightKg = null,
                            PlannedRpe = null,
                            PlannedDurationSeconds = 120,
                            PlannedDistanceMeters = 500m
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.WorkoutLogs.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Is<WorkoutLog>(w =>
                w.Exercises[0].Sets[0].PlannedDurationSeconds == 120 &&
                w.Exercises[0].Sets[0].PlannedDistanceMeters == 500m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Backward compatibility: no planned fields → existing behaviour unchanged ─

    [Fact]
    public async Task HandleAsync_WithoutPlannedFields_SetsAreNullAndIsModifiedFalse()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Deadlift",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest { SetNumber = 1, Reps = 5, WeightKg = 150m }
                        // No planned fields
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.WorkoutLogs.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Is<WorkoutLog>(w =>
                w.Exercises[0].Sets[0].PlannedReps == null &&
                w.Exercises[0].Sets[0].PlannedWeightKg == null &&
                // IsModified must be false when no snapshot exists
                !w.Exercises[0].Sets[0].IsModified),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── IsModified computed property ────────────────────────────────────────────

    [Fact]
    public void WorkoutSet_IsModified_TrueWhenRepsDiffer()
    {
        var set = new WorkoutSet
        {
            SetNumber = 1,
            Reps = 8,
            PlannedReps = 10
        };

        set.IsModified.Should().BeTrue();
    }

    [Fact]
    public void WorkoutSet_IsModified_FalseWhenActualEqualsPlanned()
    {
        var set = new WorkoutSet
        {
            SetNumber = 1,
            Reps = 10,
            WeightKg = 100m,
            PlannedReps = 10,
            PlannedWeightKg = 100m
        };

        set.IsModified.Should().BeFalse();
    }

    [Fact]
    public void WorkoutSet_IsModified_FalseWhenNoPlannedFieldsSet()
    {
        var set = new WorkoutSet
        {
            SetNumber = 1,
            Reps = 10,
            WeightKg = 100m
            // No planned fields — legacy document
        };

        set.IsModified.Should().BeFalse();
    }

    [Fact]
    public void WorkoutSet_IsModified_TrueWhenWeightDiffers()
    {
        var set = new WorkoutSet
        {
            SetNumber = 1,
            Reps = 10,
            WeightKg = 90m,
            PlannedReps = 10,
            PlannedWeightKg = 100m
        };

        set.IsModified.Should().BeTrue();
    }

    [Fact]
    public void WorkoutSet_IsModified_TrueWhenRpeDiffers()
    {
        var set = new WorkoutSet { SetNumber = 1, Rpe = 9m, PlannedRpe = 7m };
        set.IsModified.Should().BeTrue();
    }

    [Fact]
    public void WorkoutSet_IsModified_TrueWhenDurationDiffers()
    {
        var set = new WorkoutSet { SetNumber = 1, DurationSeconds = 90, PlannedDurationSeconds = 60 };
        set.IsModified.Should().BeTrue();
    }

    [Fact]
    public void WorkoutSet_IsModified_TrueWhenDistanceDiffers()
    {
        var set = new WorkoutSet { SetNumber = 1, DistanceMeters = 450m, PlannedDistanceMeters = 500m };
        set.IsModified.Should().BeTrue();
    }
}
