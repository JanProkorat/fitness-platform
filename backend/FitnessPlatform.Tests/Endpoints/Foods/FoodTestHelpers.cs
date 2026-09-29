using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
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
        Guid? nutritionistId = null,
        bool isDeleted = false,
        decimal kcal = 100,
        decimal protein = 10,
        decimal carbs = 10,
        decimal fat = 5,
        FoodVisibility visibility = FoodVisibility.Public)
    {
        return new Food
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            Name = name,
            NutritionistId = nutritionistId,
            IsDeleted = isDeleted,
            NutrientValue = new NutrientValue
            {
                Kcal = kcal,
                Protein = protein,
                Carbs = carbs,
                Fat = fat
            },
            Visibility = visibility,
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
    /// Creates a mock <see cref="IMongoCollection{Food}"/> that supports FindAsync,
    /// CountDocumentsAsync, and DistinctAsync on the <c>tags</c> field. As with FindAsync, the
    /// filter passed to DistinctAsync is not evaluated — it flattens every seeded food's Tags
    /// regardless of the filter, so visibility/filter correctness for GetFoodTagsEndpoint is
    /// covered by <see cref="FitnessPlatform.Tests.Endpoints.Recipes.OwnerScopedVisibilityFilterTests"/>
    /// (real Mongo), not by tests built on this mock.
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

        // DistinctAsync("tags", ...) — used by GetFoodTagsEndpoint.
        var distinctTags = foods
            .SelectMany(f => f.Tags)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        collection.DistinctAsync(
                Arg.Any<FieldDefinition<Food, string>>(),
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<DistinctOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(distinctTags));

        return collection;
    }

    private static IAsyncCursor<T> CreateCursor<T>(List<T> items)
    {
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(items);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return items.Count > 0;
        });
        return cursor;
    }
}
