using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Helpers for food endpoint tests — provides mocked IMongoContext with configurable collections.
/// </summary>
public static class FoodTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="Food"/> document with given properties.
    /// </summary>
    public static Food CreateFood(
        Guid? externalId = null,
        string name = "Test Food",
        string? barcode = null,
        Guid? nutritionistId = null,
        bool isDeleted = false,
        decimal kcal = 100,
        decimal protein = 10,
        decimal carbs = 10,
        decimal fat = 5)
    {
        return new Food
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            Name = name,
            Barcode = barcode,
            NutritionistId = nutritionistId,
            IsDeleted = isDeleted,
            NutrientValue = new NutrientValue
            {
                Kcal = kcal,
                Protein = protein,
                Carbs = carbs,
                Fat = fat
            },
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with the given food documents.
    /// Supports both fluent Find() and FindAsync, CountDocumentsAsync.
    /// </summary>
    public static IMongoContext CreateMockMongo(params Food[] foods)
    {
        var collection = CreateMockCollection(foods.ToList());

        var mongo = Substitute.For<IMongoContext>();
        mongo.Foods.Returns(collection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{Food}"/> that supports FindAsync and CountDocumentsAsync.
    /// </summary>
    public static IMongoCollection<Food> CreateMockCollection(List<Food> foods)
    {
        var collection = Substitute.For<IMongoCollection<Food>>();

        // FindAsync — returns cursor over all foods (filter is not evaluated in unit tests)
        collection.FindAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<FindOptions<Food, Food>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(foods));

        // CountDocumentsAsync
        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(foods.Count);

        return collection;
    }

    private static IAsyncCursor<Food> CreateCursor(List<Food> foods)
    {
        var cursor = Substitute.For<IAsyncCursor<Food>>();
        var moved = false;
        cursor.Current.Returns(foods);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return foods.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return foods.Count > 0;
        });
        return cursor;
    }
}
