namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// MongoDB collection name constants.
/// </summary>
public static class MongoCollections
{
    /// <summary>
    /// Food items collection.
    /// </summary>
    public const string Foods = "foods";

    /// <summary>
    /// Nutrition plans collection.
    /// </summary>
    public const string NutritionPlans = "nutritionPlans";

    /// <summary>
    /// Meal log entries collection.
    /// </summary>
    public const string MealLogs = "mealLogs";

    /// <summary>
    /// Recipes collection.
    /// </summary>
    public const string Recipes = "recipes";

    /// <summary>
    /// Exercises collection.
    /// </summary>
    public const string Exercises = "exercises";

    /// <summary>
    /// Training plans collection.
    /// </summary>
    public const string TrainingPlans = "trainingPlans";

    /// <summary>
    /// Workout log entries collection.
    /// </summary>
    public const string WorkoutLogs = "workoutLogs";

    /// <summary>
    /// Training completion records collection.
    /// </summary>
    public const string TrainingCompletions = "trainingCompletions";

    /// <summary>
    /// Personal record documents collection.
    /// </summary>
    public const string PersonalRecords = "personalRecords";

    /// <summary>
    /// Day-level diary log entries (photos + note per plan day).
    /// </summary>
    public const string DayLogs = "dayLogs";

    /// <summary>
    /// Legacy physical collection name for the retired "section template" concept (#857) —
    /// a single reusable workout, per trainer. Superseded by <see cref="WorkoutTemplates"/>.
    /// Referenced only by the one-time boot migration
    /// (<c>MongoIndexInitializer.MigrateWorkoutTemplateCollectionSwapAsync</c>) that renames it
    /// into the <see cref="WorkoutTemplates"/> collection — never use this for a live
    /// <c>IMongoCollection</c> accessor.
    /// </summary>
    public const string LegacySectionTemplates = "sectionTemplates";

    /// <summary>
    /// Reusable workout templates collection (#857) — a single reusable workout per trainer
    /// (formerly the "section template" concept). Populated by the one-time boot migration
    /// that renames the legacy <see cref="LegacySectionTemplates"/> collection into this one.
    /// </summary>
    public const string WorkoutTemplates = "workoutTemplates";

    /// <summary>
    /// Active session lock documents (Editing or Live state; absence = Stable).
    /// </summary>
    public const string SessionLocks = "sessionLocks";

    /// <summary>
    /// Session log entries — photos and notes attached to a specific training session diary entry.
    /// </summary>
    public const string SessionLogs = "sessionLogs";

    /// <summary>
    /// Trainer notes — private notes written by a trainer about a client.
    /// Collection name is snake_case per issue #492 specification.
    /// </summary>
    public const string TrainerNotes = "trainer_notes";

    /// <summary>
    /// Reusable full-session templates collection (#857) — a whole reusable training-session
    /// skeleton (formerly misnamed "workout templates"). Populated by the one-time boot
    /// migration that renames the legacy physical <c>workoutTemplates</c> collection (the OLD
    /// WorkoutTemplate type's collection, pre-#857) into this one.
    /// </summary>
    public const string SessionTemplates = "sessionTemplates";

    /// <summary>
    /// Session execution documents (#841) — unifies the legacy <see cref="WorkoutLogs"/> and
    /// <see cref="TrainingCompletions"/> collections into one per-(client, session, date) record.
    /// </summary>
    public const string SessionExecutions = "sessionExecutions";

    /// <summary>
    /// Reusable meal templates collection (#858 sharing-library foundation).
    /// </summary>
    public const string MealTemplates = "mealTemplates";

    /// <summary>
    /// Reusable nutrition plan templates collection (#858 sharing-library foundation).
    /// </summary>
    public const string NutritionPlanTemplates = "nutritionPlanTemplates";

    /// <summary>
    /// Reusable training plan templates collection (#858 sharing-library foundation).
    /// </summary>
    public const string TrainingPlanTemplates = "trainingPlanTemplates";
}
