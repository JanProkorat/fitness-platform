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
    /// Section template documents (per-trainer reusable training section templates).
    /// </summary>
    public const string SectionTemplates = "sectionTemplates";

    /// <summary>
    /// Active session lock documents (Editing or Live state; absence = Stable).
    /// </summary>
    public const string SessionLocks = "sessionLocks";
}
