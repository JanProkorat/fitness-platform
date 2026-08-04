using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Minimal <see cref="IMongoContext"/> implementation shared by the boot-migration
/// Testcontainers tests in this folder. Each test only exercises a handful of collections
/// directly; the remaining collections point at the same database so
/// <see cref="MongoIndexInitializer.StartAsync"/>'s full index-creation pass (which touches
/// every collection) succeeds harmlessly.
/// </summary>
internal sealed class MigrationTestMongoContext : IMongoContext
{
    private readonly IMongoDatabase _db;

    public MigrationTestMongoContext(IMongoDatabase db) => _db = db;

    public IMongoCollection<TrainingPlan> TrainingPlans => _db.GetCollection<TrainingPlan>("trainingPlans");
    public IMongoCollection<WorkoutLog> WorkoutLogs => _db.GetCollection<WorkoutLog>("workoutLogs");
    public IMongoCollection<TrainingCompletion> TrainingCompletions => _db.GetCollection<TrainingCompletion>("trainingCompletions");
    public IMongoCollection<SessionExecution> SessionExecutions => _db.GetCollection<SessionExecution>("sessionExecutions");

    public IMongoCollection<Food> Foods => _db.GetCollection<Food>("foods");
    public IMongoCollection<NutritionPlan> NutritionPlans => _db.GetCollection<NutritionPlan>("nutritionPlans");
    public IMongoCollection<MealLog> MealLogs => _db.GetCollection<MealLog>("mealLogs");
    public IMongoCollection<Exercise> Exercises => _db.GetCollection<Exercise>("exercises");
    public IMongoCollection<Recipe> Recipes => _db.GetCollection<Recipe>("recipes");
    public IMongoCollection<PersonalRecord> PersonalRecords => _db.GetCollection<PersonalRecord>("personalRecords");
    public IMongoCollection<DayLog> DayLogs => _db.GetCollection<DayLog>("dayLogs");
    public IMongoCollection<WorkoutTemplate> WorkoutTemplates => _db.GetCollection<WorkoutTemplate>("workoutTemplates");
    public IMongoCollection<SessionLock> SessionLocks => _db.GetCollection<SessionLock>("sessionLocks");
    public IMongoCollection<SessionLog> SessionLogs => _db.GetCollection<SessionLog>("sessionLogs");
    public IMongoCollection<TrainerNote> TrainerNotes => _db.GetCollection<TrainerNote>("trainer_notes");
    public IMongoCollection<SessionTemplate> SessionTemplates => _db.GetCollection<SessionTemplate>("sessionTemplates");
    public IMongoCollection<MealTemplate> MealTemplates => _db.GetCollection<MealTemplate>("mealTemplates");
    public IMongoCollection<NutritionPlanTemplate> NutritionPlanTemplates => _db.GetCollection<NutritionPlanTemplate>("nutritionPlanTemplates");
}
