using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Helpers for exercise endpoint tests — provides mocked IMongoContext with configurable collections.
/// </summary>
public static class ExerciseTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="Exercise"/> document with given properties.
    /// </summary>
    public static Exercise CreateExercise(
        Guid? externalId = null,
        string name = "Test Exercise",
        string source = "system",
        bool isCustom = false,
        Guid? trainerId = null,
        bool isActive = true,
        ExerciseCategory category = ExerciseCategory.Strength,
        ExerciseEquipment equipment = ExerciseEquipment.None,
        ExerciseDifficulty difficulty = ExerciseDifficulty.Intermediate,
        int version = 1)
    {
        return new Exercise
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            Name = name,
            Source = source,
            IsCustom = isCustom,
            TrainerId = trainerId,
            IsActive = isActive,
            Category = category,
            Equipment = equipment,
            Difficulty = difficulty,
            MuscleGroups = [MuscleGroup.Chest],
            DateCreated = DateTime.UtcNow,
            Version = version
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with the given exercise documents.
    /// By default, UpdateOneAsync returns ModifiedCount = 1 (successful update).
    /// </summary>
    public static IMongoContext CreateMockMongo(params Exercise[] exercises)
    {
        return CreateMockMongoWithUpdateResult(modifiedCount: 1, exercises);
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> where UpdateOneAsync returns the specified ModifiedCount.
    /// Use modifiedCount = 0 to simulate a concurrent write conflict (version-guarded update matched nothing).
    /// </summary>
    public static IMongoContext CreateMockMongoWithUpdateResult(long modifiedCount, params Exercise[] exercises)
    {
        var collection = CreateMockCollection(exercises.ToList(), modifiedCount);

        var mongo = Substitute.For<IMongoContext>();
        mongo.Exercises.Returns(collection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{Exercise}"/> that supports FindAsync, CountDocumentsAsync, and UpdateOneAsync.
    /// </summary>
    public static IMongoCollection<Exercise> CreateMockCollection(List<Exercise> exercises, long updateModifiedCount = 1)
    {
        var collection = Substitute.For<IMongoCollection<Exercise>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<FindOptions<Exercise, Exercise>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(exercises));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(exercises.Count);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(updateModifiedCount);
        updateResult.IsAcknowledged.Returns(true);

        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<UpdateDefinition<Exercise>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IAsyncCursor<Exercise> CreateCursor(List<Exercise> exercises)
    {
        var cursor = Substitute.For<IAsyncCursor<Exercise>>();
        var moved = false;
        cursor.Current.Returns(exercises);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return exercises.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return exercises.Count > 0;
        });
        return cursor;
    }
}
