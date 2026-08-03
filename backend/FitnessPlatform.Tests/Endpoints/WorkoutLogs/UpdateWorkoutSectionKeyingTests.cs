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
/// Tests for section-aware exercise keying in <see cref="UpdateWorkoutEndpoint"/>.
///
/// Covers issues #469 and #470:
/// — #470 WRITE: an exercise that appears in two sections (e.g. standard + AMRAP) must
///   be stored independently per section; edits in section A must not overwrite section B.
/// — #469 WRITE: every exercise in a multi-exercise workout must carry its own edits;
///   the stored set lookup must not collapse across exercises with the same id.
/// — Legacy path: a request without WorkoutId still works on single-section logs.
/// </summary>
public class UpdateWorkoutSectionKeyingTests
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

    // ── #470: exercise in standard + AMRAP — edits in standard must not leak to AMRAP ──

    /// <summary>
    /// A workout has two sections (standard, AMRAP) both containing the same exercise.
    /// The client edits sets only in the standard section. After PUT, the AMRAP section
    /// must still have its original (unedited) sets — not the standard section's values.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SameExerciseInTwoSections_EditsInStandardDoNotAffectAmrap()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var standardSectionId = Guid.NewGuid();
        var amrapSectionId = Guid.NewGuid();

        // Stored log has two sections, same exercise in each.
        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Performance!.Workouts =
        [
            new LoggedWorkout
            {
                WorkoutId = standardSectionId,
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
                            new WorkoutSet { SetNumber = 1, Reps = 5, WeightKg = 80m, PlannedReps = 5, PlannedWeightKg = 80m }
                        ]
                    }
                ]
            },
            new LoggedWorkout
            {
                WorkoutId = amrapSectionId,
                Order = 1,
                Name = "AMRAP",
                Exercises =
                [
                    new WorkoutExercise
                    {
                        ExerciseExternalId = exerciseId,
                        ExerciseName = "Squat",
                        Sets =
                        [
                            new WorkoutSet { SetNumber = 1, Reps = 3, WeightKg = 60m, PlannedReps = 3, PlannedWeightKg = 60m }
                        ]
                    }
                ]
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // PUT: client edits the standard section exercise — heavier weight.
        // AMRAP section is also included but with its own WorkoutId.
        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = standardSectionId,    // standard section
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Squat",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 5,
                            WeightKg = 100m,           // edited — heavier
                            PlannedReps = 5,
                            PlannedWeightKg = 80m
                        }
                    ]
                },
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = amrapSectionId,        // AMRAP section — unchanged
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Squat",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 3,
                            WeightKg = 60m,            // same as stored
                            PlannedReps = 3,
                            PlannedWeightKg = 60m
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The persisted log must have two independent sections.
        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                // Standard section: weight was updated to 100 kg
                w.Performance!.Workouts.First(s => s.WorkoutId == standardSectionId)
                    .Exercises[0].Sets[0].WeightKg == 100m
                &&
                // AMRAP section: weight remains at 60 kg (not contaminated by standard edit)
                w.Performance!.Workouts.First(s => s.WorkoutId == amrapSectionId)
                    .Exercises[0].Sets[0].WeightKg == 60m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── #469: multi-exercise workout — each exercise must carry its own actual values ──

    /// <summary>
    /// A workout section has three exercises. The client edits all three with different
    /// actual values. After PUT, each exercise must reflect its own actual values —
    /// not collapsed into one.
    ///
    /// Previously the snapshot lookup keyed by (ExerciseExternalId, SetNumber) and
    /// a second exercise with the same ExerciseExternalId (impossible here) would
    /// shadow the first; but the real #469 was section-collapse destroying data.
    /// This test verifies all exercises in a single section are stored independently.
    /// </summary>
    [Fact]
    public async Task HandleAsync_MultipleExercisesInSection_EachExercisePreservesItsOwnActuals()
    {
        var logId = Guid.NewGuid();
        var exerciseA = Guid.NewGuid();
        var exerciseB = Guid.NewGuid();
        var exerciseC = Guid.NewGuid();
        var sectionId = Guid.NewGuid();

        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Performance!.Workouts =
        [
            new LoggedWorkout
            {
                WorkoutId = sectionId,
                Order = 0,
                Name = "Hlavní",
                Exercises = []
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = sectionId,
                    ExerciseExternalId = exerciseA,
                    ExerciseName = "Squat",
                    Sets = [new UpdateWorkoutSetRequest { SetNumber = 1, Reps = 10, WeightKg = 100m }]
                },
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = sectionId,
                    ExerciseExternalId = exerciseB,
                    ExerciseName = "Bench Press",
                    Sets = [new UpdateWorkoutSetRequest { SetNumber = 1, Reps = 8, WeightKg = 80m }]
                },
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = sectionId,
                    ExerciseExternalId = exerciseC,
                    ExerciseName = "Deadlift",
                    Sets = [new UpdateWorkoutSetRequest { SetNumber = 1, Reps = 5, WeightKg = 150m }]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Capture the first ReplaceOneAsync call argument via ReceivedCalls.
        var replaceArgs = mongo.SessionExecutions.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(mongo.SessionExecutions.ReplaceOneAsync))
            .Select(c => c.GetArguments()[1] as SessionExecution)
            .Where(w => w is not null)
            .FirstOrDefault();

        replaceArgs.Should().NotBeNull("ReplaceOneAsync must have been called");
        var mainSection = replaceArgs!.Performance!.Workouts.First(s => s.WorkoutId == sectionId);
        mainSection.Exercises.Should().HaveCount(3);

        var squat = mainSection.Exercises.First(e => e.ExerciseExternalId == exerciseA);
        var bench = mainSection.Exercises.First(e => e.ExerciseExternalId == exerciseB);
        var deadlift = mainSection.Exercises.First(e => e.ExerciseExternalId == exerciseC);

        squat.Sets[0].WeightKg.Should().Be(100m);
        bench.Sets[0].WeightKg.Should().Be(80m);
        deadlift.Sets[0].WeightKg.Should().Be(150m);
    }

    // ── Snapshot isolation: planned values per section ────────────────────────────

    /// <summary>
    /// When the same exercise appears in two sections with different planned values,
    /// re-PUTting must freeze planned values independently per section.
    /// Standard section PlannedWeightKg = 100, AMRAP PlannedWeightKg = 60.
    /// A second PUT with swapped planned values must be ignored for both sections
    /// (stored values win).
    /// </summary>
    [Fact]
    public async Task HandleAsync_SameExerciseTwoSections_PlannedSnapshotFrozenPerSection()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var standardSectionId = Guid.NewGuid();
        var amrapSectionId = Guid.NewGuid();

        // Stored log with planned values already frozen per section.
        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Performance!.Workouts =
        [
            new LoggedWorkout
            {
                WorkoutId = standardSectionId,
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
                                Reps = 5,
                                WeightKg = 100m,
                                PlannedReps = 5,
                                PlannedWeightKg = 100m   // standard section snapshot
                            }
                        ]
                    }
                ]
            },
            new LoggedWorkout
            {
                WorkoutId = amrapSectionId,
                Order = 1,
                Name = "AMRAP",
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
                                Reps = 3,
                                WeightKg = 60m,
                                PlannedReps = 3,
                                PlannedWeightKg = 60m    // AMRAP section snapshot
                            }
                        ]
                    }
                ]
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // Second PUT: attacker/stale client sends swapped planned values.
        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = standardSectionId,
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Squat",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 5,
                            WeightKg = 100m,
                            PlannedReps = 99,           // stale — must be ignored
                            PlannedWeightKg = 999m      // stale — must be ignored
                        }
                    ]
                },
                new UpdateWorkoutExerciseRequest
                {
                    WorkoutId = amrapSectionId,
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Squat",
                    Sets =
                    [
                        new UpdateWorkoutSetRequest
                        {
                            SetNumber = 1,
                            Reps = 3,
                            WeightKg = 60m,
                            PlannedReps = 99,           // stale — must be ignored
                            PlannedWeightKg = 999m      // stale — must be ignored
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                // Standard section: original planned values preserved
                w.Performance!.Workouts.First(s => s.WorkoutId == standardSectionId)
                    .Exercises[0].Sets[0].PlannedWeightKg == 100m
                &&
                // AMRAP section: its own original planned values preserved (not standard's)
                w.Performance!.Workouts.First(s => s.WorkoutId == amrapSectionId)
                    .Exercises[0].Sets[0].PlannedWeightKg == 60m),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Legacy path: no WorkoutId → single-section fallback ──────────────────────

    /// <summary>
    /// A request from a legacy client (no WorkoutId on any exercise) must still work
    /// correctly against a single-section log — exercises are stored in the existing section.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LegacyClientNoSectionId_SingleSectionLogUnchangedBehavior()
    {
        var logId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();

        var storedLog = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);
        storedLog.Performance!.Workouts =
        [
            new LoggedWorkout
            {
                WorkoutId = sectionId,
                Order = 0,
                Name = "Hlavní",
                Exercises = []
            }
        ];

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [storedLog]);
        var ep = CreateEndpoint(mongo);

        // No WorkoutId on exercise — legacy client path.
        var request = new UpdateWorkoutRequest
        {
            LogId = logId,
            Exercises =
            [
                new UpdateWorkoutExerciseRequest
                {
                    // WorkoutId = null (default)
                    ExerciseExternalId = exerciseId,
                    ExerciseName = "Run",
                    Sets = [new UpdateWorkoutSetRequest { SetNumber = 1, DurationSeconds = 300 }]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Exercises must be in the existing single section.
        await mongo.SessionExecutions.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(w =>
                w.Performance!.Workouts.Count == 1
                && w.Performance!.Workouts[0].WorkoutId == sectionId
                && w.Performance!.Workouts[0].Exercises.Count == 1
                && w.Performance!.Workouts[0].Exercises[0].ExerciseExternalId == exerciseId),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
