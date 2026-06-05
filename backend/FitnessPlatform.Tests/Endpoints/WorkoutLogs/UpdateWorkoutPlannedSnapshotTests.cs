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

    // ── Snapshot immutability: re-PUT must not overwrite an existing snapshot ───

    /// <summary>
    /// A second PUT that supplies different Planned* values must not overwrite
    /// the snapshot recorded on the first PUT. The stored non-null values win.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RePut_WithDifferentPlannedValues_PreservesOriginalSnapshot()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        // Simulate the document as it exists AFTER the first PUT:
        // the snapshot fields are already populated.
        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Sections =
        [
            new WorkoutSection
            {
                SectionId = Guid.NewGuid(),
                Order = 0,
                Name = "Hlavní",
                Exercises =
                [
                    new WorkoutExercise
                    {
                        ExerciseExternalId = exerciseId,
                        ExerciseName = "Squat",
                        Sets =
                        [
                            new WorkoutSet
                            {
                                SetNumber = 1,
                                Reps = 8,
                                WeightKg = 100m,
                                PlannedReps = 10,       // original snapshot
                                PlannedWeightKg = 105m  // original snapshot
                            }
                        ]
                    }
                ]
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // Second PUT: coach edited the plan — client sends new Planned* values that differ.
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
                            Reps = 9,                    // actual updated
                            WeightKg = 102.5m,           // actual updated
                            PlannedReps = 12,            // attacker/stale value — must be ignored
                            PlannedWeightKg = 110m       // attacker/stale value — must be ignored
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Snapshot fields must remain at the ORIGINAL values (10, 105m), not the request values (12, 110m).
        await mongo.WorkoutLogs.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Is<WorkoutLog>(w =>
                w.Exercises[0].Sets[0].PlannedReps == 10 &&
                w.Exercises[0].Sets[0].PlannedWeightKg == 105m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A second PUT must still update actual (Reps, WeightKg, Rpe, etc.) values —
    /// only the Planned* snapshot fields are frozen, not the whole set.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RePut_UpdatesActualValuesWhilePreservingSnapshot()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        // Stored state: snapshot already set, actuals from first PUT.
        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Sections =
        [
            new WorkoutSection
            {
                SectionId = Guid.NewGuid(),
                Order = 0,
                Name = "Hlavní",
                Exercises =
                [
                    new WorkoutExercise
                    {
                        ExerciseExternalId = exerciseId,
                        ExerciseName = "Bench Press",
                        Sets =
                        [
                            new WorkoutSet
                            {
                                SetNumber = 1,
                                Reps = 5,
                                WeightKg = 80m,
                                PlannedReps = 8,
                                PlannedWeightKg = 80m
                            }
                        ]
                    }
                ]
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // Second PUT: client corrects their actual reps/weight.
        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Bench Press",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 7,              // corrected actual
                            WeightKg = 82.5m,      // corrected actual
                            PlannedReps = 99,      // should be ignored — stored is 8
                            PlannedWeightKg = 99m  // should be ignored — stored is 80m
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
                // Actuals are updated to the new values.
                w.Exercises[0].Sets[0].Reps == 7 &&
                w.Exercises[0].Sets[0].WeightKg == 82.5m &&
                // Snapshot stays frozen at original values.
                w.Exercises[0].Sets[0].PlannedReps == 8 &&
                w.Exercises[0].Sets[0].PlannedWeightKg == 80m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// An extra set added on a re-PUT (index beyond stored count) has no prior snapshot.
    /// The request's Planned* values flow through without error.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RePut_ExtraSetBeyondStoredCount_TakesRequestPlannedValues()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        // Stored state: only set 1 exists.
        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Sections =
        [
            new WorkoutSection
            {
                SectionId = Guid.NewGuid(),
                Order = 0,
                Name = "Hlavní",
                Exercises =
                [
                    new WorkoutExercise
                    {
                        ExerciseExternalId = exerciseId,
                        ExerciseName = "Pull-up",
                        Sets =
                        [
                            new WorkoutSet
                            {
                                SetNumber = 1,
                                Reps = 10,
                                PlannedReps = 10
                            }
                        ]
                    }
                ]
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // Second PUT: client adds an extra set 2 (no stored snapshot for it).
        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Pull-up",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 10,
                            PlannedReps = 99 // ignored — stored is 10
                        },
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 2,         // extra set — no stored snapshot
                            Reps = 8,
                            PlannedReps = 8        // should flow through (no stored value)
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
                // Set 1: snapshot frozen at original 10.
                w.Exercises[0].Sets[0].PlannedReps == 10 &&
                // Set 2 (extra): request planned value flows through.
                w.Exercises[0].Sets[1].PlannedReps == 8),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
