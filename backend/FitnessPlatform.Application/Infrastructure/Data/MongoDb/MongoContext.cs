using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Concrete MongoDB context providing typed collection accessors.
/// </summary>
public class MongoContext : IMongoContext
{
    /// <summary>
    /// Initializes a new instance of <see cref="MongoContext"/>.
    /// </summary>
    /// <param name="database">The MongoDB database instance from DI.</param>
    public MongoContext(IMongoDatabase database)
    {
        Foods = database.GetCollection<Food>(MongoCollections.Foods);
        NutritionPlans = database.GetCollection<NutritionPlan>(MongoCollections.NutritionPlans);
        MealLogs = database.GetCollection<MealLog>(MongoCollections.MealLogs);
        Recipes = database.GetCollection<Recipe>(MongoCollections.Recipes);
    }

    /// <inheritdoc />
    public IMongoCollection<Food> Foods { get; }

    /// <inheritdoc />
    public IMongoCollection<NutritionPlan> NutritionPlans { get; }

    /// <inheritdoc />
    public IMongoCollection<MealLog> MealLogs { get; }

    /// <inheritdoc />
    public IMongoCollection<Recipe> Recipes { get; }
}
