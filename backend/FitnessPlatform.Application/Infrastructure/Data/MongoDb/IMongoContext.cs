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
    /// Personal record documents collection.
    /// </summary>
    IMongoCollection<PersonalRecord> PersonalRecords { get; }

    /// <summary>
    /// Day-level diary log entries (photos + note per plan day).
    /// </summary>
    IMongoCollection<DayLog> DayLogs { get; }

    /// <summary>
    /// Reusable workout template documents (#857) — per-trainer, single reusable workouts
    /// (formerly the "section template" concept).
    /// </summary>
    IMongoCollection<WorkoutTemplate> WorkoutTemplates { get; }

    /// <summary>
    /// Active session lock documents.
    /// A document present = Editing or Live; absent = Stable.
    /// </summary>
    IMongoCollection<SessionLock> SessionLocks { get; }

    /// <summary>
    /// Session log entries — photos and notes attached to a specific training session diary entry.
    /// Keyed by (ClientId = ApplicationUser.Id, PlanId, SessionId, LogDate).
    /// </summary>
    IMongoCollection<SessionLog> SessionLogs { get; }

    /// <summary>
    /// Trainer notes — private notes written by a trainer about a client.
    /// Never exposed to client-authenticated callers.
    /// </summary>
    IMongoCollection<TrainerNote> TrainerNotes { get; }

    /// <summary>
    /// Reusable full-session template documents (#857) — whole reusable training-session
    /// skeletons (formerly misnamed "workout templates").
    /// </summary>
    IMongoCollection<SessionTemplate> SessionTemplates { get; }

    /// <summary>
    /// Session execution documents (#841) — one record per (client, session, date), unifying
    /// what used to be the separate <c>workoutLogs</c> and <c>trainingCompletions</c>
    /// collections. Those two were retained read-only for one release as a rollback path and
    /// were dropped in #847; this is the single source of truth for training-session
    /// execution state.
    /// </summary>
    IMongoCollection<SessionExecution> SessionExecutions { get; }

    /// <summary>
    /// Reusable meal template documents (#859 sharing library) — nutritionist-owned saved
    /// meals (foods + recipes) shareable across nutrition plans.
    /// </summary>
    IMongoCollection<MealTemplate> MealTemplates { get; }

    /// <summary>
    /// Reusable nutrition plan templates collection (#856 sharing-library model, #861).
    /// </summary>
    IMongoCollection<NutritionPlanTemplate> NutritionPlanTemplates { get; }

    /// <summary>
    /// Reusable training plan templates collection (#856 sharing-library model, #862).
    /// </summary>
    IMongoCollection<TrainingPlanTemplate> TrainingPlanTemplates { get; }
}
