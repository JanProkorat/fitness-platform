using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Hosted service that creates MongoDB indexes at application startup.
/// </summary>
public class MongoIndexInitializer : IHostedService
{
    private readonly IMongoContext _mongo;
    private readonly ILogger<MongoIndexInitializer> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="MongoIndexInitializer"/>.
    /// </summary>
    public MongoIndexInitializer(IMongoContext mongo, ILogger<MongoIndexInitializer> logger)
    {
        _mongo = mongo;
        _logger = logger;
    }

    /// <summary>
    /// Creates all required MongoDB indexes.
    /// </summary>
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating MongoDB indexes...");

        await CreateFoodIndexes(cancellationToken);
        await CreateNutritionPlanIndexes(cancellationToken);
        await CreateMealLogIndexes(cancellationToken);
        await CreateExerciseIndexes(cancellationToken);
        await CreateTrainingPlanIndexes(cancellationToken);
        await CreateWorkoutLogIndexes(cancellationToken);
        await CreateTrainingCompletionIndexes(cancellationToken);
        await CreatePersonalRecordIndexes(cancellationToken);
        await CreateSectionTemplateIndexes(cancellationToken);

        _logger.LogInformation("MongoDB indexes created successfully");
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task CreateFoodIndexes(CancellationToken ct)
    {
        var indexes = _mongo.Foods.Indexes;

        // Text index on name for fulltext search
        var textIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Text(f => f.Name),
            new CreateIndexOptions { Name = "idx_food_name_text" });

        // Index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Ascending(f => f.ExternalId),
            new CreateIndexOptions { Name = "idx_food_externalId", Unique = true });

        // Index on nutritionistId for custom food queries
        var nutritionistIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Ascending(f => f.NutritionistId),
            new CreateIndexOptions { Name = "idx_food_nutritionistId", Sparse = true });

        // One-time cleanup after the barcode feature was removed: drop the
        // legacy unique sparse index and strip any `barcode` field still
        // lingering on existing documents. Safe to run on every startup —
        // both operations are no-ops once the collection has been cleaned.
        await TryDropIndexAsync(indexes, "idx_food_barcode", ct);
        var barcodeExistsFilter = new BsonDocumentFilterDefinition<Food>(
            new BsonDocument("barcode", new BsonDocument("$exists", true)));
        var unsetResult = await _mongo.Foods.UpdateManyAsync(
            barcodeExistsFilter,
            Builders<Food>.Update.Unset("barcode"),
            cancellationToken: ct);
        if (unsetResult.ModifiedCount > 0)
        {
            _logger.LogInformation(
                "Stripped legacy `barcode` field from {Count} food document(s)",
                unsetResult.ModifiedCount);
        }

        await indexes.CreateManyAsync(
            [textIndex, externalIdIndex, nutritionistIndex],
            ct);
    }

    private static async Task TryDropIndexAsync(IMongoIndexManager<Food> indexes, string name, CancellationToken ct)
    {
        try
        {
            await indexes.DropOneAsync(name, ct);
        }
        catch (MongoCommandException ex) when (ex.CodeName == "IndexNotFound" || ex.Code == 27)
        {
            // Index did not exist — first boot on a fresh database. Fine.
        }
    }

    private async Task CreateNutritionPlanIndexes(CancellationToken ct)
    {
        var indexes = _mongo.NutritionPlans.Indexes;

        // Compound index on clientId + status for filtered queries
        var clientStatusIndex = new CreateIndexModel<NutritionPlan>(
            Builders<NutritionPlan>.IndexKeys
                .Ascending(p => p.ClientId)
                .Ascending(p => p.Status),
            new CreateIndexOptions { Name = "idx_plan_clientId_status" });

        // Index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<NutritionPlan>(
            Builders<NutritionPlan>.IndexKeys.Ascending(p => p.ExternalId),
            new CreateIndexOptions { Name = "idx_plan_externalId", Unique = true });

        await indexes.CreateManyAsync([clientStatusIndex, externalIdIndex], ct);
    }

    private async Task CreateMealLogIndexes(CancellationToken ct)
    {
        var indexes = _mongo.MealLogs.Indexes;

        // Compound index on clientId + eatenAt for date-range queries
        var clientDateIndex = new CreateIndexModel<MealLog>(
            Builders<MealLog>.IndexKeys
                .Ascending(l => l.ClientId)
                .Descending(l => l.EatenAt),
            new CreateIndexOptions { Name = "idx_meallog_clientId_eatenAt" });

        await indexes.CreateManyAsync([clientDateIndex], ct);
    }

    private async Task CreateExerciseIndexes(CancellationToken ct)
    {
        var indexes = _mongo.Exercises.Indexes;

        // Text index on name for fulltext search
        var textIndex = new CreateIndexModel<Exercise>(
            Builders<Exercise>.IndexKeys.Text(e => e.Name),
            new CreateIndexOptions { Name = "idx_exercise_name_text" });

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<Exercise>(
            Builders<Exercise>.IndexKeys.Ascending(e => e.ExternalId),
            new CreateIndexOptions { Name = "idx_exercise_externalId", Unique = true });

        // Index on muscleGroups for filter queries
        var muscleGroupIndex = new CreateIndexModel<Exercise>(
            Builders<Exercise>.IndexKeys.Ascending(e => e.MuscleGroups),
            new CreateIndexOptions { Name = "idx_exercise_muscleGroups" });

        // Index on category for filter queries
        var categoryIndex = new CreateIndexModel<Exercise>(
            Builders<Exercise>.IndexKeys.Ascending(e => e.Category),
            new CreateIndexOptions { Name = "idx_exercise_category" });

        // Sparse index on trainerId for custom exercise queries
        var trainerIndex = new CreateIndexModel<Exercise>(
            Builders<Exercise>.IndexKeys.Ascending(e => e.TrainerId),
            new CreateIndexOptions { Name = "idx_exercise_trainerId", Sparse = true });

        await indexes.CreateManyAsync(
            [textIndex, externalIdIndex, muscleGroupIndex, categoryIndex, trainerIndex],
            ct);
    }

    private async Task CreateTrainingPlanIndexes(CancellationToken ct)
    {
        var indexes = _mongo.TrainingPlans.Indexes;

        // Compound index on clientId + status for filtered queries
        var clientStatusIndex = new CreateIndexModel<TrainingPlan>(
            Builders<TrainingPlan>.IndexKeys
                .Ascending(p => p.ClientId)
                .Ascending(p => p.Status),
            new CreateIndexOptions { Name = "idx_trainingplan_clientId_status" });

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<TrainingPlan>(
            Builders<TrainingPlan>.IndexKeys.Ascending(p => p.ExternalId),
            new CreateIndexOptions { Name = "idx_trainingplan_externalId", Unique = true });

        // Index on trainerId for ownership queries
        var trainerIndex = new CreateIndexModel<TrainingPlan>(
            Builders<TrainingPlan>.IndexKeys.Ascending(p => p.TrainerId),
            new CreateIndexOptions { Name = "idx_trainingplan_trainerId" });

        await indexes.CreateManyAsync([clientStatusIndex, externalIdIndex, trainerIndex], ct);
    }

    private async Task CreateWorkoutLogIndexes(CancellationToken ct)
    {
        var indexes = _mongo.WorkoutLogs.Indexes;

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<WorkoutLog>(
            Builders<WorkoutLog>.IndexKeys.Ascending(w => w.ExternalId),
            new CreateIndexOptions { Name = "idx_workoutlog_externalId", Unique = true });

        // Compound index on clientId + startedAt for history queries
        var clientDateIndex = new CreateIndexModel<WorkoutLog>(
            Builders<WorkoutLog>.IndexKeys
                .Ascending(w => w.ClientId)
                .Descending(w => w.StartedAt),
            new CreateIndexOptions { Name = "idx_workoutlog_clientId_startedAt" });

        // Index on clientId + sessionId for finding logs by session
        var clientSessionIndex = new CreateIndexModel<WorkoutLog>(
            Builders<WorkoutLog>.IndexKeys
                .Ascending(w => w.ClientId)
                .Ascending(w => w.SessionId),
            new CreateIndexOptions { Name = "idx_workoutlog_clientId_sessionId", Sparse = true });

        await indexes.CreateManyAsync([externalIdIndex, clientDateIndex, clientSessionIndex], ct);

        // ── Backfill + dedup, BEFORE creating the partial unique index ──────────────
        //
        // Both operations are idempotent: safe on every boot.
        // They MUST run before the unique index creation or E11000 will fire on
        // existing duplicate / missing-CompletedDate documents.

        // (a) Backfill: for completed logs that have PlanId + SessionId but no
        //     CompletedDate, derive CompletedDate from CompletedAt (fall back to
        //     DateCreated when CompletedAt is null — shouldn't happen, but defensive).
        var missingDateFilter =
            Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
            & Builders<WorkoutLog>.Filter.Exists(w => w.PlanId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.SessionId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.CompletedDate, exists: false);

        using var backfillCursor = await _mongo.WorkoutLogs.FindAsync(
            missingDateFilter, cancellationToken: ct);

        var backfillBatch = await backfillCursor.ToListAsync(ct);
        var backfillCount = 0;

        foreach (var log in backfillBatch)
        {
            var sourceInstant = log.CompletedAt ?? log.DateCreated;
            var completedDate = DateOnly.FromDateTime(sourceInstant)
                .ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            await _mongo.WorkoutLogs.UpdateOneAsync(
                Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, log.ExternalId),
                Builders<WorkoutLog>.Update.Set(w => w.CompletedDate, completedDate),
                cancellationToken: ct);

            backfillCount++;
        }

        if (backfillCount > 0)
        {
            _logger.LogInformation(
                "WorkoutLog backfill: set CompletedDate on {Count} completed log(s)",
                backfillCount);
        }

        // (b) Dedup: for completed logs with duplicate (PlanId, SessionId, CompletedDate)
        //     triplets keep the most-recent by CompletedAt (tiebreak DateUpdated ?? DateCreated)
        //     and delete the rest.
        var completedWithKeyFilter =
            Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
            & Builders<WorkoutLog>.Filter.Exists(w => w.PlanId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.SessionId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.CompletedDate);

        using var dedupCursor = await _mongo.WorkoutLogs.FindAsync(
            completedWithKeyFilter, cancellationToken: ct);

        var allCompleted = await dedupCursor.ToListAsync(ct);

        var groups = allCompleted
            .GroupBy(l => (l.PlanId, l.SessionId, l.CompletedDate))
            .Where(g => g.Count() > 1);

        var deleteCount = 0;

        foreach (var group in groups)
        {
            var logsInGroup = group
                .OrderByDescending(l => l.CompletedAt ?? DateTime.MinValue)
                .ThenByDescending(l => l.DateUpdated ?? l.DateCreated)
                .ToList();

            // Keep the first (most recent); delete the rest.
            var toDelete = logsInGroup.Skip(1).Select(l => l.ExternalId).ToList();

            await _mongo.WorkoutLogs.DeleteManyAsync(
                Builders<WorkoutLog>.Filter.In(w => w.ExternalId, toDelete),
                cancellationToken: ct);

            deleteCount += toDelete.Count;
        }

        if (deleteCount > 0)
        {
            _logger.LogWarning(
                "WorkoutLog dedup: deleted {Count} duplicate completed log(s) before creating partial unique index",
                deleteCount);
        }

        // ── Partial unique index: one completed log per (planId, sessionId, completedDate) ─
        //
        // Partial filter: isCompleted==true AND all three key fields exist.
        // The Exists guards exclude in-progress logs (IsCompleted=false) and legacy logs
        // with null PlanId/SessionId/CompletedDate from the uniqueness constraint.
        // Registered as a SEPARATE CreateOneAsync after the batch above (design-review
        // finding: adding it to the existing CreateManyAsync batch would throw on dirty data).
        var partialFilter =
            Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
            & Builders<WorkoutLog>.Filter.Exists(w => w.PlanId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.SessionId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.CompletedDate);

        var uniqueCompletionIndex = new CreateIndexModel<WorkoutLog>(
            Builders<WorkoutLog>.IndexKeys
                .Ascending(w => w.PlanId)
                .Ascending(w => w.SessionId)
                .Ascending(w => w.CompletedDate),
            new CreateIndexOptions<WorkoutLog>
            {
                Name = "idx_workoutlog_planId_sessionId_completedDate_unique",
                Unique = true,
                PartialFilterExpression = partialFilter
            });

        await indexes.CreateOneAsync(uniqueCompletionIndex, cancellationToken: ct);
    }

    private async Task CreateTrainingCompletionIndexes(CancellationToken ct)
    {
        var indexes = _mongo.TrainingCompletions.Indexes;

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<TrainingCompletion>(
            Builders<TrainingCompletion>.IndexKeys.Ascending(c => c.ExternalId),
            new CreateIndexOptions { Name = "idx_trainingcompletion_externalId", Unique = true });

        // Primary query index: clientId + date for compliance roll-ups
        var clientDateIndex = new CreateIndexModel<TrainingCompletion>(
            Builders<TrainingCompletion>.IndexKeys
                .Ascending(c => c.ClientId)
                .Ascending(c => c.Date),
            new CreateIndexOptions { Name = "idx_trainingcompletion_clientId_date" });

        // Unique compound index to enforce one document per (clientId, date, sessionId)
        var clientDateSessionIndex = new CreateIndexModel<TrainingCompletion>(
            Builders<TrainingCompletion>.IndexKeys
                .Ascending(c => c.ClientId)
                .Ascending(c => c.Date)
                .Ascending(c => c.SessionId),
            new CreateIndexOptions { Name = "idx_trainingcompletion_clientId_date_sessionId", Unique = true });

        await indexes.CreateManyAsync([externalIdIndex, clientDateIndex, clientDateSessionIndex], ct);
    }

    private async Task CreatePersonalRecordIndexes(CancellationToken ct)
    {
        var indexes = _mongo.PersonalRecords.Indexes;

        // Primary query index: clientId + achievedAt (descending) for default history list
        var clientDateIndex = new CreateIndexModel<PersonalRecord>(
            Builders<PersonalRecord>.IndexKeys
                .Ascending(r => r.ClientId)
                .Descending(r => r.AchievedAt),
            new CreateIndexOptions { Name = "idx_pr_clientId_achievedAt" });

        // Per-exercise filter index: clientId + exerciseExternalId for issue #12
        var clientExerciseIndex = new CreateIndexModel<PersonalRecord>(
            Builders<PersonalRecord>.IndexKeys
                .Ascending(r => r.ClientId)
                .Ascending(r => r.ExerciseExternalId),
            new CreateIndexOptions { Name = "idx_pr_clientId_exerciseExternalId" });

        // Idempotency guard: unique compound index on (workoutLogId, exerciseExternalId, setNumber)
        // Ensures a second call to updateWorkout with the same state cannot double-insert a PR row.
        var idempotencyIndex = new CreateIndexModel<PersonalRecord>(
            Builders<PersonalRecord>.IndexKeys
                .Ascending(r => r.WorkoutLogId)
                .Ascending(r => r.ExerciseExternalId)
                .Ascending(r => r.SetNumber),
            new CreateIndexOptions
            {
                Name = "idx_pr_workoutLogId_exerciseExternalId_setNumber",
                Unique = true
            });

        await indexes.CreateManyAsync([clientDateIndex, clientExerciseIndex, idempotencyIndex], ct);
    }

    private async Task CreateSectionTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.SectionTemplates.Indexes;

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<SectionTemplate>(
            Builders<SectionTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_sectiontemplate_externalId", Unique = true });

        // Index on ownerTrainerId for per-trainer list queries
        var ownerIndex = new CreateIndexModel<SectionTemplate>(
            Builders<SectionTemplate>.IndexKeys.Ascending(t => t.OwnerTrainerId),
            new CreateIndexOptions { Name = "idx_sectiontemplate_ownerTrainerId" });

        await indexes.CreateManyAsync([externalIdIndex, ownerIndex], ct);
    }
}
