using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Abstraction over MongoDB collections for dependency injection and unit testing.
/// Mirrors <see cref="IApplicationDbContext"/> pattern for PostgreSQL.
/// </summary>
public interface IMongoContext
{
    /// <summary>
    /// Food items collection.
    /// </summary>
    IMongoCollection<Food> Foods { get; }

    /// <summary>
    /// Nutrition plans collection.
    /// </summary>
    IMongoCollection<NutritionPlan> NutritionPlans { get; }

    /// <summary>
    /// Meal log entries collection.
    /// </summary>
    IMongoCollection<MealLog> MealLogs { get; }

    /// <summary>
    /// Recipes collection.
    /// </summary>
    IMongoCollection<Recipe> Recipes { get; }
}
