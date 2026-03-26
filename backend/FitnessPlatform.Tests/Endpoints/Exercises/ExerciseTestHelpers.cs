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
        ExerciseDifficulty difficulty = ExerciseDifficulty.Intermediate)
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
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with the given exercise documents.
    /// </summary>
    public static IMongoContext CreateMockMongo(params Exercise[] exercises)
    {
        var collection = CreateMockCollection(exercises.ToList());

        var mongo = Substitute.For<IMongoContext>();
        mongo.Exercises.Returns(collection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{Exercise}"/> that supports FindAsync and CountDocumentsAsync.
    /// </summary>
    public static IMongoCollection<Exercise> CreateMockCollection(List<Exercise> exercises)
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
