using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Helpers for recipe endpoint tests — provides mocked IMongoContext backed by in-memory lists.
/// </summary>
public static class RecipeTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="Recipe"/> document with the given properties.
    /// </summary>
    public static Recipe CreateRecipe(
        Guid? externalId = null,
        Guid? nutritionistId = null,
        string name = "Test Recipe",
        RecipeVisibility visibility = RecipeVisibility.Public,
        List<MealFood>? foods = null)
    {
        return new Recipe
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            NutritionistId = nutritionistId ?? Guid.NewGuid(),
            Name = name,
            Foods = foods ?? [],
            TotalNutrients = new NutrientTotals(),
            Visibility = visibility,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> whose Recipes and Foods collections
    /// return the provided documents from FindAsync/CountDocumentsAsync.
    /// </summary>
    public static IMongoContext CreateMockMongo(Recipe[]? recipes = null, Food[]? foods = null)
    {
        // Configure each collection FULLY before wiring it into the context — NSubstitute cannot
        // track lastCall state across nested substitute setup.
        var recipeCollection = CreateRecipeCollection((recipes ?? []).ToList());
        var foodCollection = CreateFoodCollection((foods ?? []).ToList());

        var mongo = Substitute.For<IMongoContext>();
        mongo.Recipes.Returns(recipeCollection);
        mongo.Foods.Returns(foodCollection);
        return mongo;
    }

    private static IMongoCollection<Recipe> CreateRecipeCollection(List<Recipe> recipes)
    {
        var collection = Substitute.For<IMongoCollection<Recipe>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<Recipe>>(),
                Arg.Any<FindOptions<Recipe, Recipe>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(recipes));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<Recipe>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(recipes.Count);

        return collection;
    }

    private static IMongoCollection<Food> CreateFoodCollection(List<Food> foods)
    {
        var collection = Substitute.For<IMongoCollection<Food>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<FindOptions<Food, Food>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(foods));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(foods.Count);

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
