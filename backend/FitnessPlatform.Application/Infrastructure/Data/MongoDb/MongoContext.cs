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
        Exercises = database.GetCollection<Exercise>(MongoCollections.Exercises);
        TrainingPlans = database.GetCollection<TrainingPlan>(MongoCollections.TrainingPlans);
        WorkoutLogs = database.GetCollection<WorkoutLog>(MongoCollections.WorkoutLogs);
        TrainingCompletions = database.GetCollection<TrainingCompletion>(MongoCollections.TrainingCompletions);
        PersonalRecords = database.GetCollection<PersonalRecord>(MongoCollections.PersonalRecords);
        DayLogs = database.GetCollection<DayLog>(MongoCollections.DayLogs);
        WorkoutTemplates = database.GetCollection<WorkoutTemplate>(MongoCollections.WorkoutTemplates);
        SessionLocks = database.GetCollection<SessionLock>(MongoCollections.SessionLocks);
        SessionLogs = database.GetCollection<SessionLog>(MongoCollections.SessionLogs);
        TrainerNotes = database.GetCollection<TrainerNote>(MongoCollections.TrainerNotes);
        SessionTemplates = database.GetCollection<SessionTemplate>(MongoCollections.SessionTemplates);
        SessionExecutions = database.GetCollection<SessionExecution>(MongoCollections.SessionExecutions);
        MealTemplates = database.GetCollection<MealTemplate>(MongoCollections.MealTemplates);
        NutritionPlanTemplates = database.GetCollection<NutritionPlanTemplate>(MongoCollections.NutritionPlanTemplates);
        TrainingPlanTemplates = database.GetCollection<TrainingPlanTemplate>(MongoCollections.TrainingPlanTemplates);
    }

    /// <inheritdoc />
    public IMongoCollection<Food> Foods { get; }

    /// <inheritdoc />
    public IMongoCollection<NutritionPlan> NutritionPlans { get; }

    /// <inheritdoc />
    public IMongoCollection<MealLog> MealLogs { get; }

    /// <inheritdoc />
    public IMongoCollection<Recipe> Recipes { get; }

    /// <inheritdoc />
    public IMongoCollection<Exercise> Exercises { get; }

    /// <inheritdoc />
    public IMongoCollection<TrainingPlan> TrainingPlans { get; }

    /// <inheritdoc />
    public IMongoCollection<WorkoutLog> WorkoutLogs { get; }

    /// <inheritdoc />
    public IMongoCollection<TrainingCompletion> TrainingCompletions { get; }

    /// <inheritdoc />
    public IMongoCollection<PersonalRecord> PersonalRecords { get; }

    /// <inheritdoc />
    public IMongoCollection<DayLog> DayLogs { get; }

    /// <inheritdoc />
    public IMongoCollection<WorkoutTemplate> WorkoutTemplates { get; }

    /// <inheritdoc />
    public IMongoCollection<SessionLock> SessionLocks { get; }

    /// <inheritdoc />
    public IMongoCollection<SessionLog> SessionLogs { get; }

    /// <inheritdoc />
    public IMongoCollection<TrainerNote> TrainerNotes { get; }

    /// <inheritdoc />
    public IMongoCollection<SessionTemplate> SessionTemplates { get; }

    /// <inheritdoc />
    public IMongoCollection<SessionExecution> SessionExecutions { get; }

    /// <inheritdoc />
    public IMongoCollection<MealTemplate> MealTemplates { get; }

    /// <inheritdoc />
    public IMongoCollection<NutritionPlanTemplate> NutritionPlanTemplates { get; }

    /// <inheritdoc />
    public IMongoCollection<TrainingPlanTemplate> TrainingPlanTemplates { get; }
}
