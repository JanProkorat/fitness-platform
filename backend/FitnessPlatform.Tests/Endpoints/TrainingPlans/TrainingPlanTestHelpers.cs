using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
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
    /// Creates a mocked <see cref="IMongoContext"/> with training plans + workout logs.
    /// </summary>
    public static IMongoContext CreateMockMongoWithLogs(
        TrainingPlan[] plans,
        WorkoutLog[] workoutLogs)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Pre-create collections BEFORE calling .Returns() to avoid NSubstitute
        // "last call" confusion (CouldNotSetReturnDueToNoLastCallException).
        var plansCollection = CreateMockCollection(plans.ToList());
        var logsCollection = CreateMockWorkoutLogCollection(workoutLogs.ToList());

        mongo.TrainingPlans.Returns(plansCollection);
        mongo.WorkoutLogs.Returns(logsCollection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{WorkoutLog}"/> that returns the given logs from FindAsync().
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

        return collection;
    }

    /// <summary>
    /// Creates a mocked <see cref="ProfessionalAuthHelper"/> that returns true for HasActiveLinkAsync.
    /// </summary>
    public static ProfessionalAuthHelper CreateMockAuthHelper(bool hasLink = true)
    {
        var db = Substitute.For<IApplicationDbContext>();
        var authHelper = Substitute.For<ProfessionalAuthHelper>(db);
        authHelper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
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
