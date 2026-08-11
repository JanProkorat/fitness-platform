using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FitnessPlatform.Tests.Infrastructure;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="GetTodaySessionEndpoint"/> — verifies that
/// <c>LoggedSetsBySessionExercise</c> and <c>HasModificationsBySession</c>
/// are correctly populated from WorkoutLog data.
/// </summary>
public class GetTodaySessionLoggedSetsTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _userIdGuid = Guid.NewGuid(); // ApplicationUser.Id (used in WorkoutLog.ClientId)

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _userIdGuid, PublicId = _clientId })
            .Build();

    private static int TodayDow()
    {
        var dow = (int)DateTime.UtcNow.DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    private IMongoContext CreateMongoWithPlanAndLog(
        TrainingPlan plan,
        List<WorkoutLog>? workoutLogs = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Plans collection
        var plans = new List<TrainingPlan> { plan };
        var planCollection = Substitute.For<IMongoCollection<TrainingPlan>>();
        planCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                return cursor;
            });
        mongo.TrainingPlans.Returns(planCollection);

        // Exercises collection (empty — muscle groups not needed for these tests)
        var exerciseCollection = Substitute.For<IMongoCollection<Exercise>>();
        exerciseCollection.FindAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<FindOptions<Exercise, Exercise>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<Exercise>>();
                var moved = false;
                cursor.Current.Returns(new List<Exercise>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => false);
                return cursor;
            });
        mongo.Exercises.Returns(exerciseCollection);

        // TrainingCompletions collection (empty for these tests)
        var completionCollection = Substitute.For<IMongoCollection<TrainingCompletion>>();
        completionCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
                var moved = false;
                cursor.Current.Returns(new List<TrainingCompletion>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => false);
                return cursor;
            });
        mongo.TrainingCompletions.Returns(completionCollection);

        // WorkoutLogs collection
        var logDocs = workoutLogs ?? [];
        var logCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        logCollection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<WorkoutLog>>();
                var moved = false;
                cursor.Current.Returns(logDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return logDocs.Count > 0; });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return logDocs.Count > 0; });
                return cursor;
            });
        mongo.WorkoutLogs.Returns(logCollection);

        // SessionExecutions (#841) — GetTodaySessionEndpoint reads this collection
        // exclusively; the TrainingCompletions/WorkoutLogs stubs above are retained only
        // for legacy call-site compatibility and are never consulted by the endpoint.
        var executionDocs = logDocs.Select(TrainingCompletionTestHelpers.ToSessionExecution).ToList();
        var executionCollection = Substitute.For<IMongoCollection<SessionExecution>>();
        executionCollection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<SessionExecution>>();
                var moved = false;
                cursor.Current.Returns(executionDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return executionDocs.Count > 0; });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return executionDocs.Count > 0; });
                return cursor;
            });
        mongo.SessionExecutions.Returns(executionCollection);

        // SessionLogs collection (empty)
        var sessionLogCollection = Substitute.For<IMongoCollection<SessionLog>>();
        sessionLogCollection.FindAsync(
                Arg.Any<FilterDefinition<SessionLog>>(),
                Arg.Any<FindOptions<SessionLog, SessionLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<SessionLog>>();
                var moved = false;
                cursor.Current.Returns(new List<SessionLog>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => false);
                return cursor;
            });
        mongo.SessionLogs.Returns(sessionLogCollection);

        return mongo;
    }

    private GetTodaySessionEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db)
    {
        var lockService = Substitute.For<ISessionLockService>();
        lockService.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new List<SessionLock>() as IReadOnlyList<SessionLock>);

        return Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_userIdGuid, AppRoles.Client))),
            mongo, db, lockService, new FakeBlobStorageService());
    }

    private TrainingPlan BuildPlanWithSession(Guid sessionId, Guid exerciseId, int dow)
    {
        var startOfWeek = StartOfCurrentWeek();
        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Days = TrainingPlanTestHelpers.MaterializeDays((dow, new TrainingSession
                    {
                        SessionId = sessionId,
                        Name = "Test Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = Guid.NewGuid(),
                                Order = 0,
                                Name = "Hlavní",
                                Exercises =
                                [
                                    new SessionExercise
                                    {
                                        ExerciseExternalId = exerciseId,
                                        ExerciseName = "Squat",
                                        Order = 1,
                                        Sets =
                                        [
                                            new ExerciseSet { SetNumber = 1, Reps = 10, WeightKg = 80m },
                                            new ExerciseSet { SetNumber = 2, Reps = 10, WeightKg = 80m }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }))
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };
    }

    // ── LoggedSetsBySessionExercise populated from WorkoutLog ──────────────────

    [Fact]
    public async Task HandleAsync_WithWorkoutLog_PopulatesLoggedSetsBySessionExercise()
    {
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var todayDow = TodayDow();
        var plan = BuildPlanWithSession(sessionId, exerciseId, todayDow);
        var db = CreateMockDb();

        var workoutLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _userIdGuid,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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
                                    Reps = 10,
                                    WeightKg = 80m,
                                    PlannedReps = 10,
                                    PlannedWeightKg = 80m,
                                    CompletedAt = DateTime.UtcNow
                                },
                                new WorkoutSet
                                {
                                    SetNumber = 2,
                                    Reps = 8,            // actual differs from plan
                                    WeightKg = 80m,
                                    PlannedReps = 10,    // planned was 10
                                    PlannedWeightKg = 80m,
                                    CompletedAt = DateTime.UtcNow
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlanAndLog(plan, [workoutLog]);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        var response = ep.Response;

        response.LoggedSetsBySessionExercise.Should().ContainKey(sessionId);
        var exerciseSets = response.LoggedSetsBySessionExercise[sessionId];
        exerciseSets.Should().ContainKey(exerciseId);

        var sets = exerciseSets[exerciseId];
        sets.Should().HaveCount(2);

        // Set 1: actual == planned → IsModified = false
        var set1 = sets.Single(s => s.SetNumber == 1);
        set1.ActualReps.Should().Be(10);
        set1.PlannedReps.Should().Be(10);
        set1.IsModified.Should().BeFalse();

        // Set 2: actual (8) != planned (10) → IsModified = true
        var set2 = sets.Single(s => s.SetNumber == 2);
        set2.ActualReps.Should().Be(8);
        set2.PlannedReps.Should().Be(10);
        set2.IsModified.Should().BeTrue();
    }

    // ── HasModificationsBySession set when any set is modified ─────────────────

    [Fact]
    public async Task HandleAsync_WithModifiedSet_SetsHasModificationsBySession()
    {
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var todayDow = TodayDow();
        var plan = BuildPlanWithSession(sessionId, exerciseId, todayDow);
        var db = CreateMockDb();

        var workoutLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _userIdGuid,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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
                                    Reps = 7,         // actual differs
                                    WeightKg = 80m,
                                    PlannedReps = 10, // planned
                                    PlannedWeightKg = 80m,
                                    CompletedAt = DateTime.UtcNow
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlanAndLog(plan, [workoutLog]);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.HasModificationsBySession.Should().ContainKey(sessionId);
        ep.Response.HasModificationsBySession[sessionId].Should().BeTrue();
    }

    // ── HasModificationsBySession absent when all sets are as-planned ──────────

    [Fact]
    public async Task HandleAsync_WithNoModifiedSets_HasModificationsAbsentOrFalse()
    {
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var todayDow = TodayDow();
        var plan = BuildPlanWithSession(sessionId, exerciseId, todayDow);
        var db = CreateMockDb();

        var workoutLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _userIdGuid,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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
                                    Reps = 10,
                                    WeightKg = 80m,
                                    PlannedReps = 10,     // matches actual
                                    PlannedWeightKg = 80m,
                                    CompletedAt = DateTime.UtcNow
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlanAndLog(plan, [workoutLog]);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Should NOT have a true entry for this session
        if (ep.Response.HasModificationsBySession.TryGetValue(sessionId, out var val))
            val.Should().BeFalse();
        // else: absent key is treated as false — pass
    }

    // ── Backward compatible: legacy sets without planned fields → IsModified false ─

    [Fact]
    public async Task HandleAsync_WithLegacySetNoPlannedFields_IsModifiedFalse()
    {
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var todayDow = TodayDow();
        var plan = BuildPlanWithSession(sessionId, exerciseId, todayDow);
        var db = CreateMockDb();

        var workoutLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _userIdGuid,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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
                                    Reps = 10,
                                    WeightKg = 80m,
                                    // No planned fields — simulates legacy document
                                    CompletedAt = DateTime.UtcNow
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlanAndLog(plan, [workoutLog]);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.LoggedSetsBySessionExercise.Should().ContainKey(sessionId);
        var sets = ep.Response.LoggedSetsBySessionExercise[sessionId][exerciseId];
        sets[0].IsModified.Should().BeFalse();
        sets[0].PlannedReps.Should().BeNull();
    }

    // ── No log → empty LoggedSetsBySessionExercise ─────────────────────────────

    [Fact]
    public async Task HandleAsync_WithNoWorkoutLog_LoggedSetsIsEmpty()
    {
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var todayDow = TodayDow();
        var plan = BuildPlanWithSession(sessionId, exerciseId, todayDow);
        var db = CreateMockDb();

        var mongo = CreateMongoWithPlanAndLog(plan, []);
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.LoggedSetsBySessionExercise.Should().BeEmpty();
        ep.Response.HasModificationsBySession.Should().BeEmpty();
    }
}
