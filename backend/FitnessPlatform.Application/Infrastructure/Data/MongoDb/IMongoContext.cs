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

    /// <summary>
    /// Exercises collection.
    /// </summary>
    IMongoCollection<Exercise> Exercises { get; }

    /// <summary>
    /// Training plans collection.
    /// </summary>
    IMongoCollection<TrainingPlan> TrainingPlans { get; }

    /// <summary>
    /// Workout log entries collection.
    /// </summary>
    IMongoCollection<WorkoutLog> WorkoutLogs { get; }

    /// <summary>
    /// Training completion records collection.
    /// </summary>
    IMongoCollection<TrainingCompletion> TrainingCompletions { get; }

    /// <summary>
    /// Personal record documents collection.
    /// </summary>
    IMongoCollection<PersonalRecord> PersonalRecords { get; }

    /// <summary>
    /// Day-level diary log entries (photos + note per plan day).
    /// </summary>
    IMongoCollection<DayLog> DayLogs { get; }

    /// <summary>
    /// Section template documents (per-trainer reusable training section templates).
    /// </summary>
    IMongoCollection<SectionTemplate> SectionTemplates { get; }
}
