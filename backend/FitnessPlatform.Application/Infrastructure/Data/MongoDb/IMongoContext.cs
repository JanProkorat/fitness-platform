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

    /// <summary>
    /// Active session lock documents.
    /// A document present = Editing or Live; absent = Stable.
    /// </summary>
    IMongoCollection<SessionLock> SessionLocks { get; }

    /// <summary>
    /// Session log entries — photos and notes attached to a specific training session diary entry.
    /// Keyed by (ClientId = ClientProfile.PublicId, PlanId, SessionId, LogDate).
    /// </summary>
    IMongoCollection<SessionLog> SessionLogs { get; }

    /// <summary>
    /// Trainer notes — private notes written by a trainer about a client.
    /// Never exposed to client-authenticated callers.
    /// </summary>
    IMongoCollection<TrainerNote> TrainerNotes { get; }

    /// <summary>
    /// Reusable workout templates collection.
    /// </summary>
    IMongoCollection<WorkoutTemplate> WorkoutTemplates { get; }
}
