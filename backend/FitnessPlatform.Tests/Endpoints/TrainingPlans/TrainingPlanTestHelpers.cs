using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Test helpers for training plan endpoint tests.
/// </summary>
public static class TrainingPlanTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="TrainingPlan"/> with configurable properties.
    /// </summary>
    public static TrainingPlan CreatePlan(
        Guid? externalId = null,
        Guid? clientId = null,
        Guid? trainerId = null,
        string name = "Test Training Plan",
        TrainingPlanStatus status = TrainingPlanStatus.Draft,
        int weekCount = 1,
        int version = 1)
    {
        return new TrainingPlan
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            TrainerId = trainerId ?? Guid.NewGuid(),
            Name = name,
            Status = status,
            Weeks = Enumerable.Range(1, weekCount).Select(w => new TrainingWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Draft,
                Sessions = []
            }).ToList(),
            Version = version,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with training plans collection.
    /// </summary>
    public static IMongoContext CreateMockMongo(params TrainingPlan[] plans)
        => CreateMockMongoWithLogs(plans: plans, workoutLogs: []);

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with training plans + workout logs +
    /// an optional list of training completions. Completions default to an empty collection.
    /// </summary>
    public static IMongoContext CreateMockMongoWithLogs(
        TrainingPlan[] plans,
        WorkoutLog[] workoutLogs,
        TrainingCompletion[]? trainingCompletions = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Pre-create collections BEFORE calling .Returns() to avoid NSubstitute
        // "last call" confusion (CouldNotSetReturnDueToNoLastCallException).
        var plansCollection = CreateMockCollection(plans.ToList());
        var logsCollection = CreateMockWorkoutLogCollection(workoutLogs.ToList());
        var completionsCollection = CreateMockCompletionCollection(
            (trainingCompletions ?? []).ToList());

        mongo.TrainingPlans.Returns(plansCollection);
        mongo.WorkoutLogs.Returns(logsCollection);
        mongo.TrainingCompletions.Returns(completionsCollection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{TrainingCompletion}"/> that returns the given
    /// completions from FindAsync.
    /// </summary>
    public static IMongoCollection<TrainingCompletion> CreateMockCompletionCollection(
        List<TrainingCompletion> completions)
    {
        var collection = Substitute.For<IMongoCollection<TrainingCompletion>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCompletionCursor(completions));

        return collection;
    }

    private static IAsyncCursor<TrainingCompletion> CreateCompletionCursor(
        List<TrainingCompletion> completions)
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
            if (moved) return Task.FromResult(false);
            moved = true;
            return Task.FromResult(completions.Count > 0);
        });
        return cursor;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{WorkoutLog}"/> that returns the given logs from FindAsync(),
    /// and stubs InsertOneAsync and ReplaceOneAsync so they succeed without mutating state.
    /// </summary>
    public static IMongoCollection<WorkoutLog> CreateMockWorkoutLogCollection(List<WorkoutLog> logs)
    {
        var collection = Substitute.For<IMongoCollection<WorkoutLog>>();
        var cursor = CreateWorkoutLogCursor(logs);
        // Pre-wrap in a completed Task BEFORE calling .Returns() to avoid NSubstitute
        // "last call" confusion (CouldNotSetReturnDueToNoLastCallException).
        var cursorTask = Task.FromResult(cursor);

        collection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(cursorTask);

        // InsertOneAsync — no-op stub so the endpoint can materialize new logs.
        collection.InsertOneAsync(
                Arg.Any<WorkoutLog>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        // ReplaceOneAsync stub
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
            if (moved) return Task.FromResult(false);
            moved = true;
            return Task.FromResult(logs.Count > 0);
        });
        return cursor;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{TrainingPlan}"/> supporting FindAsync, CountDocumentsAsync, ReplaceOneAsync, UpdateOneAsync, and UpdateManyAsync.
    /// </summary>
    public static IMongoCollection<TrainingPlan> CreateMockCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(plans));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(plans.Count);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<TrainingPlan>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<UpdateDefinition<TrainingPlan>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        collection.UpdateManyAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<UpdateDefinition<TrainingPlan>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        // FindOneAndUpdateAsync — default stub for the #839 targeted-$set publish path.
        // Tests exercising the write path (success / genuine-race-conflict) override this with an
        // explicit .Returns() for the specific plan/null they expect; this default is only reached
        // by tests that never get past validation (e.g. NotFound, AlreadyPublished).
        collection.FindOneAndUpdateAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<UpdateDefinition<TrainingPlan>>(),
                Arg.Any<FindOneAndUpdateOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns((TrainingPlan?)plans.FirstOrDefault());

        return collection;
    }

    /// <summary>
    /// Computes the most recent past Monday (UTC, date only).
    /// If today is Monday it returns the Monday one week ago so the date is strictly in the past.
    /// Handles Sunday correctly (DayOfWeek.Sunday = 0, which would otherwise produce a negative offset).
    /// Use this whenever a test plan needs a Monday StartDate — avoids date-flaky test failures on
    /// non-Monday CI runs where <c>DateTime.UtcNow.AddDays(-7)</c> may land on a non-Monday.
    /// </summary>
    public static DateTime LastMonday()
    {
        var today = DateTime.UtcNow.Date;
        int dayNum = (int)today.DayOfWeek; // Sunday=0, Monday=1, ..., Saturday=6
        int daysBack = dayNum switch
        {
            0 => 6, // Sunday: last Monday was 6 days ago
            1 => 7, // Monday: use the Monday one week ago (not today)
            _ => dayNum - 1  // Tue–Sat: subtract to reach Monday
        };
        return DateTime.SpecifyKind(today.AddDays(-daysBack), DateTimeKind.Utc);
    }

    /// <summary>
    /// Creates a no-op <see cref="ISessionLockService"/> that always returns an empty lock list.
    /// Use in tests that don't care about lock state.
    /// </summary>
    public static ISessionLockService CreateNoOpLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<SessionLock>());
        return svc;
    }

    /// <summary>
    /// Creates a mocked <see cref="ISessionLockService"/> that returns the given lock documents.
    /// </summary>
    public static ISessionLockService CreateLockServiceWith(params SessionLock[] locks)
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(locks.ToList());
        return svc;
    }

    /// <summary>
    /// Creates a mocked <see cref="ProfessionalAuthHelper"/> that returns <paramref name="hasLink"/>
    /// for HasActiveLinkAsync and <paramref name="hasPlanAccess"/> for HasPlanAccessAsync
    /// (used by #590's CanViewTrainingPlans server-side enforcement).
    /// </summary>
    public static ProfessionalAuthHelper CreateMockAuthHelper(bool hasLink = true, bool hasPlanAccess = true)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var authHelper = Substitute.For<ProfessionalAuthHelper>(db);
        authHelper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        authHelper.HasPlanAccessAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(hasPlanAccess);
        return authHelper;
    }

    private static IAsyncCursor<TrainingPlan> CreateCursor(List<TrainingPlan> plans)
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
}
