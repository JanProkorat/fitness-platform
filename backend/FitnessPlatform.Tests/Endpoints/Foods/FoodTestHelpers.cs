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
    /// Creates a mocked <see cref="IMongoContext"/> with the given food documents. FoodTags and
    /// FoodTagAssignments are stubbed empty (#1120) — a test that needs specific tag data uses the
    /// <see cref="CreateMockMongo(Food[],FoodTag[],FoodTagAssignment[])"/> overload instead.
    /// Supports both fluent Find() and FindAsync, CountDocumentsAsync.
    /// </summary>
    public static IMongoContext CreateMockMongo(params Food[] foods) => CreateMockMongo(foods, [], []);

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with the given food, food-tag, and
    /// food-tag-assignment documents. As with the Food-only overload, filters passed to FindAsync
    /// are not evaluated — every seeded document of the matching type is returned regardless of
    /// the filter, so owner-scoping correctness lives in real-Mongo integration tests, not here.
    /// </summary>
    public static IMongoContext CreateMockMongo(Food[] foods, FoodTag[] foodTags, FoodTagAssignment[] assignments)
    {
        // Each collection is built into a local BEFORE any .Returns() call — inlining
        // CreateMockCollection(...) directly as a .Returns() argument configures a nested
        // substitute while the outer call's "last call" is still pending, which throws
        // NSubstitute.Exceptions.CouldNotSetReturnDueToNoLastCallException (its own docs warn
        // against exactly this: "avoid mySub.SomeMethod().Returns(ConfigOtherSub())").
        var foodsCollection = CreateMockCollection(foods.ToList());
        var foodTagsCollection = CreateMockCollection(foodTags.ToList());
        var foodTagAssignmentsCollection = CreateMockCollection(assignments.ToList());

        var mongo = Substitute.For<IMongoContext>();
        mongo.Foods.Returns(foodsCollection);
        mongo.FoodTags.Returns(foodTagsCollection);
        mongo.FoodTagAssignments.Returns(foodTagAssignmentsCollection);
        return mongo;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{Food}"/> that supports FindAsync and
    /// CountDocumentsAsync. The filter passed to FindAsync is not evaluated in these unit tests —
    /// owner/visibility correctness is covered by
    /// <see cref="FitnessPlatform.Tests.Endpoints.Recipes.OwnerScopedVisibilityFilterTests"/>
    /// (real Mongo), not by tests built on this mock.
    /// </summary>
    public static IMongoCollection<Food> CreateMockCollection(List<Food> foods) => CreateMockCollection<Food>(foods);

    /// <summary>
    /// Generic form of <see cref="CreateMockCollection(List{Food})"/> — stubs FindAsync and
    /// CountDocumentsAsync for any document type, used for the FoodTags/FoodTagAssignments
    /// collections in addition to Food.
    /// </summary>
    private static IMongoCollection<T> CreateMockCollection<T>(List<T> documents)
    {
        var collection = Substitute.For<IMongoCollection<T>>();

        // FindAsync — returns cursor over all documents (filter is not evaluated in unit tests)
        collection.FindAsync(
                Arg.Any<FilterDefinition<T>>(),
                Arg.Any<FindOptions<T, T>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateCursor(documents));

        // CountDocumentsAsync
        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<T>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(documents.Count);

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
