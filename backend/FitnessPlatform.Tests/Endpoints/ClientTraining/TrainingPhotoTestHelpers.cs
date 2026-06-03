using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Shared helpers for training session photo endpoint tests.
/// Mirrors the pattern from <see cref="NutritionPlans.PlanTestHelpers.CreateMockMongo"/>.
/// </summary>
public static class TrainingPhotoTestHelpers
{
    /// <summary>
    /// Creates a mock <see cref="IMongoContext"/> backed by a single optional
    /// <see cref="TrainingPlan"/> and an empty <see cref="SessionLog"/> collection.
    /// All other collections are stubbed with empty cursors.
    /// </summary>
    public static IMongoContext CreateMongoWithPlan(
        TrainingPlan? plan,
        List<SessionLog>? sessionLogs = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Build all collections BEFORE calling .Returns() to avoid the NSubstitute
        // "CouldNotSetReturnDueToNoLastCallException" that fires when a Substitute.For<>
        // call happens inside a .Returns() lambda.
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();
        var planCollection = CreateCollection(plans);
        var sessionLogCollection = CreateSessionLogCollection(sessionLogs ?? []);
        var exerciseCollection = CreateCollection<Exercise>([]);
        var completionCollection = CreateCollection<TrainingCompletion>([]);
        var workoutLogCollection = CreateCollection<WorkoutLog>([]);
        var sessionLockCollection = CreateCollection<SessionLock>([]);

        // Assign after all substitutes are created
        mongo.TrainingPlans.Returns(planCollection);
        mongo.SessionLogs.Returns(sessionLogCollection);
        mongo.Exercises.Returns(exerciseCollection);
        mongo.TrainingCompletions.Returns(completionCollection);
        mongo.WorkoutLogs.Returns(workoutLogCollection);
        mongo.SessionLocks.Returns(sessionLockCollection);

        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{T}"/> whose <c>FindAsync</c> always returns
    /// <paramref name="docs"/>.
    /// </summary>
    internal static IMongoCollection<T> CreateCollection<T>(List<T> docs)
    {
        var collection = Substitute.For<IMongoCollection<T>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<T>>(),
                Arg.Any<FindOptions<T, T>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(docs));
        return collection;
    }

    internal static IMongoCollection<SessionLog> CreateSessionLogCollection(
        List<SessionLog> docs,
        List<SessionLog>? captureInserted = null)
    {
        var collection = Substitute.For<IMongoCollection<SessionLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<SessionLog>>(),
                Arg.Any<FindOptions<SessionLog, SessionLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(docs));

        collection.InsertOneAsync(
                Arg.Do<SessionLog>(log => captureInserted?.Add(log)),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<SessionLog>>(),
                Arg.Any<UpdateDefinition<SessionLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IAsyncCursor<T> CreateCursor<T>(List<T> docs)
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(docs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return docs.Count > 0;
        });
        return cursor;
    }
}
