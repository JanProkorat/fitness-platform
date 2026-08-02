using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Helpers for creating test data and mocks for training completion endpoint tests.
/// </summary>
public static class TrainingCompletionTestHelpers
{
    /// <summary>
    /// Returns the Monday of the current UTC week.
    /// </summary>
    /// <remarks>
    /// Root cause of the #726-lookalike "scheduler-zombie" CI flake investigated for
    /// epic #835/PR #854: this file's fixtures previously computed the week start as
    /// <c>DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek + 1)</c>. That
    /// formula is correct for Monday(1)..Saturday(6) but breaks on Sunday, where
    /// <see cref="DayOfWeek.Sunday"/> is <c>0</c>: <c>-(0) + 1 = +1</c> pushes the
    /// computed "Monday" to TOMORROW instead of 6 days in the past. Every real
    /// Sunday, the seeded <see cref="TrainingPlan.StartDate"/> lands in the future,
    /// <c>PlanWindowResolver.ResolveCurrentPlan</c> legitimately finds no plan whose
    /// window contains "today", and the endpoint under test returns a genuine 404 —
    /// deterministically, in CI and locally alike, on any machine's real calendar
    /// Sunday. This is why the failure was 100% reproducible in complete isolation
    /// (no Testcontainers, no other tests) yet had never been seen before: the branch
    /// had simply never had CI run on a Sunday until now. Uses the same
    /// ISO-week-safe formula already proven correct elsewhere in this suite (see
    /// <c>GetTodaySessionEndpointTests.StartOfCurrentWeek()</c>).
    /// </remarks>
    public static DateTime StartOfCurrentWeekUtc()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    /// <summary>
    /// Creates an active <see cref="TrainingPlan"/> with one published week containing
    /// sessions for every day of the week. Each session has the given exercises in a single section.
    /// </summary>
    /// <param name="clientId">Client identifier.</param>
    /// <param name="sessionId">Session identifier (defaults to a new Guid).</param>
    /// <param name="exerciseIds">Exercise external IDs (defaults to two new Guids).</param>
    /// <param name="startDate">Plan start date (defaults to Monday of the current week).</param>
    /// <param name="trainerId">Trainer identifier (defaults to a new Guid).</param>
    /// <param name="sectionId">
    ///   Optional section ID to use for the single "Hlavní" section in every session.
    ///   When supplied, both the target session and all other sessions use the same sectionId
    ///   (sufficient for single-section tests). Defaults to a shared new Guid.
    /// </param>
    /// <returns>The created plan.</returns>
    public static TrainingPlan CreateActivePlan(
        Guid clientId,
        Guid? sessionId = null,
        IReadOnlyList<Guid>? exerciseIds = null,
        DateTime? startDate = null,
        Guid? trainerId = null,
        Guid? sectionId = null)
    {
        var sid = sessionId ?? Guid.NewGuid();
        var secId = sectionId ?? Guid.NewGuid();
        var exIds = exerciseIds ?? [Guid.NewGuid(), Guid.NewGuid()];
        var start = startDate ?? StartOfCurrentWeekUtc();

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = trainerId ?? Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = start,
                    Sessions = Enumerable.Range(1, 7).Select(d => new TrainingSession
                    {
                        SessionId = d == (int)DateTime.UtcNow.DayOfWeek || d == 1 ? sid : Guid.NewGuid(),
                        DayOfWeek = d,
                        Name = $"Day {d} Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = secId,
                                Order = 0,
                                Name = "Hlavní",
                                Exercises = exIds.Select((id, i) => new SessionExercise
                                {
                                    ExerciseExternalId = id,
                                    ExerciseName = $"Exercise {i + 1}",
                                    Order = i + 1,
                                    Sets = []
                                }).ToList()
                            }
                        ]
                    }).ToList()
                }
            ],
            Version = 1,
            DateCreated = start
        };
    }

    /// <summary>
    /// Creates an active <see cref="TrainingPlan"/> where the target session has two sections,
    /// each containing the same catalog exercise. This is the canonical "same exercise in two sections"
    /// scenario that caused the original cross-section checkbox bug.
    /// </summary>
    /// <returns>
    ///   The plan plus the two section IDs. The <paramref name="exerciseId"/> appears in both sections.
    /// </returns>
    public static (TrainingPlan Plan, Guid Section1Id, Guid Section2Id)
        CreateActivePlanWithDuplicateExerciseAcrossSections(
            Guid clientId,
            Guid sessionId,
            Guid exerciseId)
    {
        var section1Id = Guid.NewGuid();
        var section2Id = Guid.NewGuid();
        var start = StartOfCurrentWeekUtc();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Duplicate Exercise Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = start,
                    Sessions = Enumerable.Range(1, 7).Select(d => new TrainingSession
                    {
                        SessionId = d == (int)DateTime.UtcNow.DayOfWeek || d == 1 ? sessionId : Guid.NewGuid(),
                        DayOfWeek = d,
                        Name = $"Day {d} Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = section1Id,
                                Order = 0,
                                Name = "Section A",
                                Exercises =
                                [
                                    new SessionExercise
                                    {
                                        ExerciseExternalId = exerciseId,
                                        ExerciseName = "Shared Exercise",
                                        Order = 1,
                                        Sets = []
                                    }
                                ]
                            },
                            new TrainingWorkout
                            {
                                WorkoutId = section2Id,
                                Order = 1,
                                Name = "Section B",
                                Exercises =
                                [
                                    new SessionExercise
                                    {
                                        ExerciseExternalId = exerciseId,
                                        ExerciseName = "Shared Exercise",
                                        Order = 1,
                                        Sets = []
                                    }
                                ]
                            }
                        ]
                    }).ToList()
                }
            ],
            Version = 1,
            DateCreated = start
        };

        return (plan, section1Id, section2Id);
    }

    /// <summary>
    /// Creates a <see cref="SessionExecution"/> document (checkbox-only — no Performance) for the
    /// given session and date. #841: unifies the retired <c>TrainingCompletion</c> document this
    /// helper used to build; kept the same name/parameter shape for minimal call-site churn across
    /// the ClientTraining test suite.
    /// </summary>
    public static SessionExecution CreateCompletion(
        Guid clientId,
        Guid sessionId,
        DateTime date,
        IReadOnlyList<Guid>? completedExerciseIds = null,
        IReadOnlyList<Guid>? completedSectionIds = null,
        int version = 1,
        Dictionary<string, List<Guid>>? completedExerciseIdsBySection = null)
    {
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            Date = date.Date,
            SessionId = sessionId,
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseIds = completedExerciseIds?.ToList() ?? [],
            CompletedWorkoutIds = completedSectionIds?.ToList(),
            CompletedExerciseIdsBySection = completedExerciseIdsBySection,
            DateCreated = DateTime.UtcNow,
            Version = version
        };
    }

    /// <summary>
    /// Creates an active <see cref="TrainingPlan"/> where the session has one exercise-free section
    /// (e.g. a ForTime section with no exercises) alongside an optional standard section with exercises.
    /// Useful for testing section-level compliance.
    /// </summary>
    public static (TrainingPlan Plan, Guid ForTimeSectionId, Guid StandardSectionId, Guid[] ExerciseIds)
        CreateActivePlanWithMixedSections(
            Guid clientId,
            Guid sessionId,
            Guid[]? exerciseIds = null)
    {
        var forTimeSectionId = Guid.NewGuid();
        var standardSectionId = Guid.NewGuid();
        var exIds = exerciseIds ?? [Guid.NewGuid(), Guid.NewGuid()];
        var start = StartOfCurrentWeekUtc();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Mixed Sections Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = start,
                    Sessions = Enumerable.Range(1, 7).Select(d => new TrainingSession
                    {
                        SessionId = d == (int)DateTime.UtcNow.DayOfWeek || d == 1 ? sessionId : Guid.NewGuid(),
                        DayOfWeek = d,
                        Name = $"Day {d} Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = forTimeSectionId,
                                Order = 0,
                                Name = "ForTime",
                                Exercises = [] // exercise-free section
                            },
                            new TrainingWorkout
                            {
                                WorkoutId = standardSectionId,
                                Order = 1,
                                Name = "Hlavní",
                                Exercises = exIds.Select((id, i) => new SessionExercise
                                {
                                    ExerciseExternalId = id,
                                    ExerciseName = $"Exercise {i + 1}",
                                    Order = i + 1,
                                    Sets = []
                                }).ToList()
                            }
                        ]
                    }).ToList()
                }
            ],
            Version = 1,
            DateCreated = start
        };

        return (plan, forTimeSectionId, standardSectionId, exIds);
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoContext"/> with configured collections for training plans
    /// and (#841) the unified SessionExecutions collection. <paramref name="existingCompletion"/>
    /// is a checkbox-flag-only <see cref="SessionExecution"/> (see <see cref="CreateCompletion"/>);
    /// <paramref name="workoutLogs"/> is retained for call-site compatibility with tests written
    /// against the retired dual-collection model — Performance-bearing fixtures passed here are
    /// converted to SessionExecution documents and merged into the SAME stubbed collection, since
    /// every Mark*/GetTodaySession endpoint under test now reads exclusively
    /// <see cref="IMongoContext.SessionExecutions"/>.
    /// </summary>
    public static (IMongoContext Mongo, IMongoCollection<SessionExecution> ExecutionCollection)
        CreateMockMongo(
            TrainingPlan? plan = null,
            SessionExecution? existingCompletion = null,
            IReadOnlyList<WorkoutLog>? workoutLogs = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Training plans
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();
        var planCollection = CreateMockPlanCollection(plans);
        mongo.TrainingPlans.Returns(planCollection);

        // SessionExecutions (#841) — checkbox-flag fixture plus any Performance-bearing
        // WorkoutLog fixtures translated to SessionExecution documents.
        var executions = new List<SessionExecution>();
        if (existingCompletion is not null)
            executions.Add(existingCompletion);
        foreach (var log in workoutLogs ?? [])
            executions.Add(ToSessionExecution(log));

        var executionCollection = CreateMockSessionExecutionCollection(executions);
        mongo.SessionExecutions.Returns(executionCollection);

        return (mongo, executionCollection);
    }

    /// <summary>
    /// Converts a legacy <see cref="WorkoutLog"/> fixture into a Performance-bearing
    /// <see cref="SessionExecution"/> — the shape every ClientTraining endpoint under test now
    /// reads instead of the retired WorkoutLog document (#841).
    /// </summary>
    public static SessionExecution ToSessionExecution(WorkoutLog log)
    {
        return new SessionExecution
        {
            ExternalId = log.ExternalId,
            ClientId = log.ClientId,
            PlanId = log.PlanId,
            SessionId = log.SessionId,
            Date = log.CompletedDate ?? WorkoutLog.ToCompletionDateUtc(log.StartedAt),
            Status = log.IsCompleted ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = log.StartedAt,
                CompletedAt = log.CompletedAt,
                Mood = log.Mood,
                Notes = log.Notes,
                WodResult = log.WodResult,
                Sections = log.Sections
            },
            DateCreated = log.DateCreated,
            DateUpdated = log.DateUpdated,
            Version = 1
        };
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{SessionExecution}"/> backed by the supplied list.
    /// FindAsync/CountDocumentsAsync return-value semantics mirror the pre-#841
    /// CreateMockCompletionCollection; InsertOneAsync/UpdateOneAsync/ReplaceOneAsync are stubbed to
    /// succeed without mutating the seeded list (tests inspect the in-memory objects directly or
    /// assert on ReceivedCalls()).
    /// </summary>
    public static IMongoCollection<SessionExecution> CreateMockSessionExecutionCollection(
        List<SessionExecution> executions,
        bool updateSucceeds = true)
    {
        var collection = Substitute.For<IMongoCollection<SessionExecution>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateExecutionCursor(executions));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(executions.Count);

        collection.InsertOneAsync(
                Arg.Any<SessionExecution>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(updateSucceeds ? 1L : 0L);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<UpdateDefinition<SessionExecution>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1L);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<SessionExecution>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        return collection;
    }

    private static IAsyncCursor<SessionExecution> CreateExecutionCursor(List<SessionExecution> executions)
    {
        var cursor = Substitute.For<IAsyncCursor<SessionExecution>>();
        var moved = false;
        cursor.Current.Returns(executions);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return executions.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return executions.Count > 0;
        });
        return cursor;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{WorkoutLog}"/> backed by the supplied list.
    /// <see cref="IMongoCollection{WorkoutLog}.ReplaceOneAsync"/> is stubbed to return success
    /// without mutating the list (the test inspects the in-memory objects directly).
    /// </summary>
    public static IMongoCollection<WorkoutLog> CreateMockWorkoutLogCollection(
        IReadOnlyList<WorkoutLog> logs)
    {
        var collection = Substitute.For<IMongoCollection<WorkoutLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateWorkoutLogCursor(logs.ToList()));

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1L);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<WorkoutLog>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        return collection;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{TrainingCompletion}"/> with basic operations.
    /// </summary>
    public static IMongoCollection<TrainingCompletion> CreateMockCompletionCollection(
        List<TrainingCompletion> completions,
        bool updateSucceeds = true)
    {
        var collection = Substitute.For<IMongoCollection<TrainingCompletion>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCompletionCursor(completions));

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(updateSucceeds ? 1L : 0L);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<UpdateDefinition<TrainingCompletion>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IMongoCollection<TrainingPlan> CreateMockPlanCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreatePlanCursor(plans));

        return collection;
    }

    private static IAsyncCursor<TrainingPlan> CreatePlanCursor(List<TrainingPlan> plans)
    {
        var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
        var moved = false;
        cursor.Current.Returns(plans);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        return cursor;
    }

    /// <summary>
    /// Creates a no-op <see cref="IRealtimeNotifier"/> substitute for tests that don't care about broadcasts.
    /// </summary>
    public static IRealtimeNotifier CreateStubNotifier()
    {
        return Substitute.For<IRealtimeNotifier>();
    }

    /// <summary>
    /// Creates an <see cref="IComplianceService"/> substitute that returns neutral defaults
    /// (0% compliance, 0 streak) for tests that don't care about broadcast payload values.
    /// </summary>
    public static IComplianceService CreateStubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();
        svc.CalculateComplianceAsync(
                Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult { CompliancePercent = 0m });
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(0);
        return svc;
    }

    private static IAsyncCursor<TrainingCompletion> CreateCompletionCursor(List<TrainingCompletion> completions)
    {
        var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
        var moved = false;
        cursor.Current.Returns(completions);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        return cursor;
    }

    private static IAsyncCursor<WorkoutLog> CreateWorkoutLogCursor(List<WorkoutLog> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<WorkoutLog>>();
        var moved = false;
        cursor.Current.Returns(logs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        return cursor;
    }
}
