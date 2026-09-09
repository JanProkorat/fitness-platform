using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
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
                Days = MaterializeDays()
            }).ToList(),
            Version = version,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Materializes a full 7-day <see cref="TrainingWeek.Days"/> list (1=Monday..7=Sunday) from a
    /// flat list of (dayOfWeek, session) pairs — mirrors how <see cref="TrainingDay"/> is always
    /// fully materialised on the production write path, even for days carrying no sessions. Two
    /// pairs sharing the same day both land under that day, preserving multi-session-per-day
    /// fixtures.
    /// </summary>
    public static List<TrainingDay> MaterializeDays(params (int DayOfWeek, TrainingSession Session)[] sessions)
    {
        var days = Enumerable.Range(1, 7)
            .Select(dayOfWeek => new TrainingDay { DayOfWeek = dayOfWeek, Sessions = [] })
            .ToList();

        foreach (var (dayOfWeek, session) in sessions)
        {
            days.First(d => d.DayOfWeek == dayOfWeek).Sessions.Add(session);
        }

        return days;
    }

    /// <summary>
    /// Creates a single-week, single-day <see cref="TrainingPlan"/> wrapping exactly the given
    /// <paramref name="session"/> (placed on Monday). Convenience for tests that need a session
    /// carrying <see cref="TrainingSession.StandaloneExercises"/> alongside
    /// <see cref="TrainingSession.Workouts"/> — the plain <see cref="CreatePlan"/> helper builds
    /// only empty days.
    /// </summary>
    public static TrainingPlan CreatePlanWithSession(
        TrainingSession session,
        Guid? externalId = null,
        Guid? clientId = null,
        Guid? trainerId = null,
        string name = "Test Training Plan",
        TrainingPlanStatus status = TrainingPlanStatus.Active,
        int version = 1)
    {
        return new TrainingPlan
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            TrainerId = trainerId ?? Guid.NewGuid(),
            Name = name,
            Status = status,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days = MaterializeDays((1, session))
                }
            ],
            Version = version,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with training plans collection.
    /// </summary>
    public static IMongoContext CreateMockMongo(params TrainingPlan[] plans)
        => CreateMockMongoWithLogs(plans: plans, executions: []);

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with training plans + an optional list of
    /// <see cref="SessionExecution"/> documents. #841:
    /// <see cref="GetTrainingPlan.GetTrainingPlanEndpoint"/> (and friends) read exclusively from
    /// the unified <see cref="IMongoContext.SessionExecutions"/> collection.
    /// </summary>
    public static IMongoContext CreateMockMongoWithLogs(
        TrainingPlan[] plans,
        List<SessionExecution> executions)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Pre-create collections BEFORE calling .Returns() to avoid NSubstitute
        // "last call" confusion (CouldNotSetReturnDueToNoLastCallException).
        var plansCollection = CreateMockCollection(plans.ToList());
        var executionsCollection = CreateMockSessionExecutionCollection(executions);

        mongo.TrainingPlans.Returns(plansCollection);
        mongo.SessionExecutions.Returns(executionsCollection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{SessionExecution}"/> that returns the given
    /// executions from FindAsync()/CountDocumentsAsync(), and stubs InsertOneAsync/ReplaceOneAsync
    /// so they succeed without mutating state.
    /// #841: every WorkoutLogs/TrainingPlans read/write site now targets this unified collection
    /// instead of the retired WorkoutLogs/TrainingCompletions collections.
    /// </summary>
    public static IMongoCollection<SessionExecution> CreateMockSessionExecutionCollection(List<SessionExecution> executions)
    {
        var collection = Substitute.For<IMongoCollection<SessionExecution>>();
        var cursor = CreateSessionExecutionCursor(executions);
        var cursorTask = Task.FromResult(cursor);

        collection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(cursorTask);

        // NSubstitute can't evaluate the real FilterDefinition, so this approximates the two
        // shapes production code actually queries: FinishSessionEndpoint's "already completed"
        // guard filters on Status==Completed; pagination totals want the full seeded count.
        // Counting only Completed executions is the safer default — it keeps a Partial-only
        // fixture from tripping the "already completed" guard in tests that never intended it.
        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(executions.Count(e => e.Status == SessionExecutionStatus.Completed));

        collection.InsertOneAsync(
                Arg.Any<SessionExecution>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1L);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<SessionExecution>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1L);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<UpdateDefinition<SessionExecution>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IAsyncCursor<SessionExecution> CreateSessionExecutionCursor(List<SessionExecution> executions)
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
            if (moved) return Task.FromResult(false);
            moved = true;
            return Task.FromResult(executions.Count > 0);
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
    /// Creates a mocked <see cref="IClientLinkAuthorizationService"/> that reports no active link
    /// at all — both the PublicId- and UserId-addressed overloads return <see langword="null"/>,
    /// and the batch overload returns an empty list. Use for a deny-path test that must fail
    /// loudly (403/404, never a silently-granted 200) if the link guard were ever removed.
    /// </summary>
    public static IClientLinkAuthorizationService CreateDenyingLinkAuthorizationService()
    {
        var service = Substitute.For<IClientLinkAuthorizationService>();
        service.GetCapabilitiesByClientPublicIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((LinkCapabilities?)null);
        service.GetCapabilitiesByClientUserIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((LinkCapabilities?)null);
        service.GetAccessibleClientsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>(), Arg.Any<LinkCapabilityScope?>())
            .Returns([]);
        return service;
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
