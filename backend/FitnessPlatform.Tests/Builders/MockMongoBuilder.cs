using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Builder for creating a mocked <see cref="IMongoContext"/> with pre-populated collections.
/// </summary>
public class MockMongoBuilder
{
    private readonly List<Food> _foods = [];
    private readonly List<NutritionPlan> _nutritionPlans = [];
    private readonly List<MealLog> _mealLogs = [];

    /// <summary>
    /// Adds a <see cref="Food"/> document to the mock context.
    /// </summary>
    public MockMongoBuilder WithFood(Food food) { _foods.Add(food); return this; }

    /// <summary>
    /// Adds a <see cref="NutritionPlan"/> document to the mock context.
    /// </summary>
    public MockMongoBuilder WithNutritionPlan(NutritionPlan plan) { _nutritionPlans.Add(plan); return this; }

    /// <summary>
    /// Adds a <see cref="MealLog"/> document to the mock context.
    /// </summary>
    public MockMongoBuilder WithMealLog(MealLog log) { _mealLogs.Add(log); return this; }

    /// <summary>
    /// Builds a mocked <see cref="IMongoContext"/> with configured collections.
    /// Uses <see cref="IAsyncCursor{TDocument}"/> mocks for Find operations.
    /// </summary>
    public IMongoContext Build()
    {
        var foodsCollection = CreateMockCollection(_foods);
        var plansCollection = CreateMockCollection(_nutritionPlans);
        var mealLogsCollection = CreateMockCollection(_mealLogs);

        var mongo = Substitute.For<IMongoContext>();
        mongo.Foods.Returns(foodsCollection);
        mongo.NutritionPlans.Returns(plansCollection);
        mongo.MealLogs.Returns(mealLogsCollection);

        return mongo;
    }

    private static IMongoCollection<T> CreateMockCollection<T>(List<T> documents)
    {
        var collection = Substitute.For<IMongoCollection<T>>();

        // Mock Find to return documents via an async cursor
        var cursor = Substitute.For<IAsyncCursor<T>>();
        var moved = false;
        cursor.Current.Returns(documents);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return documents.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return documents.Count > 0;
        });

        collection.FindAsync(
                Arg.Any<FilterDefinition<T>>(),
                Arg.Any<FindOptions<T, T>>(),
                Arg.Any<CancellationToken>())
            .Returns(cursor);

        return collection;
    }
}
