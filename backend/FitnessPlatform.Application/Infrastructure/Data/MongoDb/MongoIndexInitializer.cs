using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Creates MongoDB indexes at application startup.
/// </summary>
/// <remarks>
/// Registered in <c>Program.cs</c> as a plain <c>AddSingleton</c>, NOT
/// <c>AddHostedService</c>. <see cref="StartAsync"/> is invoked explicitly and
/// awaited immediately before <c>app.Run()</c> — deliberately NOT via the
/// <see cref="IHostedService"/> pipeline. Hosted services start sequentially in
/// registration order, and the framework's own web-hosting service (which starts
/// Kestrel listening) is registered ahead of anything user code adds afterwards —
/// so wiring this class via <c>AddHostedService</c> would let Kestrel begin
/// accepting requests before the unique indexes created below exist, opening a
/// window for a duplicate-key race those indexes exist to prevent. This class
/// still exposes the <see cref="StartAsync"/>/<see cref="StopAsync"/> shape (and
/// tests still construct it directly, e.g. <c>new MongoIndexInitializer(mongo, logger)</c>)
/// purely for familiarity/consistency — it is not resolved as an <c>IHostedService</c>
/// anywhere in this codebase.
/// </remarks>
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
    /// Creates all required MongoDB indexes. Must be awaited to completion before the
    /// app serves any request — see the class-level remarks and the explicit call site
    /// in <c>Program.cs</c>.
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
        await CreateWorkoutTemplateIndexes(cancellationToken);
        await CreateSessionLockIndexes(cancellationToken);
        await CreateSessionTemplateIndexes(cancellationToken);
        await CreateSessionExecutionIndexes(cancellationToken);
        await CreateMealTemplateIndexes(cancellationToken);
        await CreateNutritionPlanTemplateIndexes(cancellationToken);
        await CreateTrainingPlanTemplateIndexes(cancellationToken);

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

    private static async Task TryDropIndexAsync<T>(IMongoIndexManager<T> indexes, string name, CancellationToken ct)
    {
        try
        {
            await indexes.DropOneAsync(name, ct);
        }
        catch (MongoCommandException ex) when (ex.CodeName == "IndexNotFound" || ex.Code == 27)
        {
            // Index did not exist — first boot on a fresh database, or already dropped
            // by a previous boot. Fine.
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

    private async Task CreateWorkoutTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.WorkoutTemplates.Indexes;

        // Unique index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<WorkoutTemplate>(
            Builders<WorkoutTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_workouttemplate_externalId", Unique = true });

        // Index on ownerTrainerId for per-trainer list queries
        var ownerIndex = new CreateIndexModel<WorkoutTemplate>(
            Builders<WorkoutTemplate>.IndexKeys.Ascending(t => t.OwnerTrainerId),
            new CreateIndexOptions { Name = "idx_workouttemplate_ownerTrainerId" });

        await indexes.CreateManyAsync([externalIdIndex, ownerIndex], ct);
    }

    private async Task CreateSessionLockIndexes(CancellationToken ct)
    {
        var indexes = _mongo.SessionLocks.Indexes;

        // Unique index on sessionId — this is the mutual-exclusion primitive.
        // InsertOneAsync throwing E11000 on this index is the acquire-conflict signal.
        var sessionIdIndex = new CreateIndexModel<SessionLock>(
            Builders<SessionLock>.IndexKeys.Ascending(l => l.SessionId),
            new CreateIndexOptions { Name = "idx_sessionlock_sessionId", Unique = true });

        // TTL index on expiresAt — Mongo's reaper deletes the document automatically
        // when expiresAt passes (expireAfterSeconds: 0 means "delete at the expiry instant").
        // Note: this is the codebase's first TTL index. The reaper runs ~every 60s,
        // so query-layer checks must also filter expiresAt > now (done in GetStateAsync).
        var ttlIndex = new CreateIndexModel<SessionLock>(
            Builders<SessionLock>.IndexKeys.Ascending(l => l.ExpiresAt),
            new CreateIndexOptions
            {
                Name = "idx_sessionlock_expiresAt_ttl",
                ExpireAfter = TimeSpan.Zero
            });

        // Index on clientId for fan-out reads (badges / notifications to the client).
        var clientIdIndex = new CreateIndexModel<SessionLock>(
            Builders<SessionLock>.IndexKeys.Ascending(l => l.ClientId),
            new CreateIndexOptions { Name = "idx_sessionlock_clientId" });

        // Index on planId for batch state reads per plan (GetStateAsync by plan).
        var planIdIndex = new CreateIndexModel<SessionLock>(
            Builders<SessionLock>.IndexKeys.Ascending(l => l.PlanId),
            new CreateIndexOptions { Name = "idx_sessionlock_planId" });

        await indexes.CreateManyAsync([sessionIdIndex, ttlIndex, clientIdIndex, planIdIndex], ct);
    }

    /// <summary>
    /// Creates the SessionTemplate indexes: ExternalId (unique, the sole lookup key
    /// <c>LibraryDenialExtensions</c>' loaders depend on for correctness), OwnerId (per-trainer
    /// list queries, mirrors <c>WorkoutTemplate</c>'s ownerTrainerId), and
    /// DateCreated+ExternalId (the <see cref="FitnessPlatform.Application.Domain.Services.LibrarySearchHelper"/>
    /// default sort, mandated by <see cref="ILibraryDocument"/> — see #859's
    /// <c>idx_mealtemplate_dateCreated_externalId</c> precedent).
    /// </summary>
    private async Task CreateSessionTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.SessionTemplates.Indexes;

        // Unique index on externalId for API lookups and MongoSeeder's per-document dedupe.
        var externalIdIndex = new CreateIndexModel<SessionTemplate>(
            Builders<SessionTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_sessiontemplate_externalId", Unique = true });

        // Index on ownerId for per-trainer list queries (mirrors WorkoutTemplate's ownerTrainerId).
        var ownerIndex = new CreateIndexModel<SessionTemplate>(
            Builders<SessionTemplate>.IndexKeys.Ascending(t => t.OwnerId),
            new CreateIndexOptions { Name = "idx_sessiontemplate_ownerId" });

        // Matches LibrarySearchHelper's default sort — mandated by ILibraryDocument for every
        // sharing-library collection so paged search doesn't collection-scan.
        var dateCreatedIndex = new CreateIndexModel<SessionTemplate>(
            Builders<SessionTemplate>.IndexKeys.Descending(t => t.DateCreated).Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_sessiontemplate_dateCreated_externalId" });

        await indexes.CreateManyAsync([externalIdIndex, ownerIndex, dateCreatedIndex], ct);
    }

    /// <summary>
    /// Required indexes for the nutrition-plan-template sharing library (#856/#861) — see
    /// <see cref="ILibraryDocument"/>'s remarks: <c>{ externalId: 1 }</c> unique is a
    /// correctness requirement (the sole lookup key for
    /// <see cref="LibraryDenialExtensions.LoadLibraryEntryForReadOrRespondAsync{TDoc}"/> /
    /// <see cref="LibraryDenialExtensions.LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>), and
    /// <c>{ dateCreated: -1, externalId: 1 }</c> matches
    /// <see cref="FitnessPlatform.Application.Domain.Services.LibrarySearchHelper"/>'s sort.
    /// </summary>
    private async Task CreateNutritionPlanTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.NutritionPlanTemplates.Indexes;

        var externalIdIndex = new CreateIndexModel<NutritionPlanTemplate>(
            Builders<NutritionPlanTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_nutritionplantemplate_externalId", Unique = true });

        var searchIndex = new CreateIndexModel<NutritionPlanTemplate>(
            Builders<NutritionPlanTemplate>.IndexKeys.Descending(t => t.DateCreated).Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_nutritionplantemplate_dateCreated_externalId" });

        await indexes.CreateManyAsync([externalIdIndex, searchIndex], ct);
    }

    // ── #862: TrainingPlanTemplate sharing-library indexes ─────────────────────────
    //
    // Per ILibraryDocument's remarks, every sharing-library collection must carry a unique
    // externalId index (the sole lookup key LibraryDenialExtensions' loaders depend on for
    // correctness — a duplicate would make the ownership/visibility guard judge the wrong
    // document) plus the LibrarySearchHelper default-sort index.
    /// <summary>
    /// Creates the TrainingPlanTemplate indexes: ExternalId (unique) — the correctness
    /// requirement (the sole lookup key for
    /// <see cref="LibraryDenialExtensions.LoadLibraryEntryForReadOrRespondAsync{TDoc}"/> /
    /// <see cref="LibraryDenialExtensions.LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>), and
    /// <c>{ dateCreated: -1, externalId: 1 }</c> matches
    /// <see cref="FitnessPlatform.Application.Domain.Services.LibrarySearchHelper"/>'s sort.
    /// </summary>
    private async Task CreateTrainingPlanTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.TrainingPlanTemplates.Indexes;

        var externalIdIndex = new CreateIndexModel<TrainingPlanTemplate>(
            Builders<TrainingPlanTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_trainingplantemplate_externalId", Unique = true });

        var searchIndex = new CreateIndexModel<TrainingPlanTemplate>(
            Builders<TrainingPlanTemplate>.IndexKeys.Descending(t => t.DateCreated).Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_trainingplantemplate_dateCreated_externalId" });

        await indexes.CreateManyAsync([externalIdIndex, searchIndex], ct);
    }

    // ── #859: MealTemplate sharing-library indexes ────────────────────────────────
    //
    // Per ILibraryDocument's remarks, every sharing-library collection must carry a unique
    // externalId index (the sole lookup key LibraryDenialExtensions' loaders depend on for
    // correctness — a duplicate would make the ownership/visibility guard judge the wrong
    // document) plus the LibrarySearchHelper default-sort index. The meal library's default sort
    // is calories descending (design §5.1), not DateCreated, so it also carries the
    // totalNutrients.kcal index the flagship search needs to avoid a collection scan; the
    // dateCreated index is retained anyway per the interface's blanket per-library mandate.
    /// <summary>
    /// Creates the MealTemplate indexes: ExternalId (unique), DateCreated+ExternalId (the
    /// <c>LibrarySearchHelper</c> default sort, mandated by <see cref="ILibraryDocument"/>
    /// even though this library's search does not use it as its primary sort), and
    /// TotalNutrients.Kcal+ExternalId (this library's actual default sort).
    /// </summary>
    private async Task CreateMealTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.MealTemplates.Indexes;

        var externalIdIndex = new CreateIndexModel<MealTemplate>(
            Builders<MealTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_mealtemplate_externalId", Unique = true });

        var dateCreatedIndex = new CreateIndexModel<MealTemplate>(
            Builders<MealTemplate>.IndexKeys.Descending(t => t.DateCreated).Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_mealtemplate_dateCreated_externalId" });

        var kcalIndex = new CreateIndexModel<MealTemplate>(
            Builders<MealTemplate>.IndexKeys.Descending(t => t.TotalNutrients.Kcal).Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_mealtemplate_kcal_externalId" });

        await indexes.CreateManyAsync([externalIdIndex, dateCreatedIndex, kcalIndex], ct);
    }

    // ── #841: SessionExecution — unified WorkoutLog + TrainingCompletion indexes ─────
    //
    // Reconciles two prior constraints into one:
    //   - WorkoutLog's partial-unique (planId, sessionId, completedDate | isCompleted==true)
    //   - TrainingCompletion's unconditional unique (clientId, date, sessionId)
    // into a single partial-unique (clientId, sessionId, date) index, active whenever BOTH
    // sessionId and date are present (i.e. NOT limited to completed executions — the whole
    // point of the merge is that a session has exactly one execution per day, draft or done).
    // Ad-hoc (unplanned) executions have a null SessionId and are exempt.
    /// <summary>
    /// Creates the SessionExecution indexes (ExternalId unique, ClientId+Date, and the
    /// partial-unique ClientId+SessionId+Date).
    /// </summary>
    private async Task CreateSessionExecutionIndexes(CancellationToken ct)
    {
        var indexes = _mongo.SessionExecutions.Indexes;

        var externalIdIndex = new CreateIndexModel<SessionExecution>(
            Builders<SessionExecution>.IndexKeys.Ascending(e => e.ExternalId),
            new CreateIndexOptions { Name = "idx_sessionexecution_externalId", Unique = true });

        var clientDateIndex = new CreateIndexModel<SessionExecution>(
            Builders<SessionExecution>.IndexKeys
                .Ascending(e => e.ClientId)
                .Ascending(e => e.Date),
            new CreateIndexOptions { Name = "idx_sessionexecution_clientId_date" });

        await indexes.CreateManyAsync([externalIdIndex, clientDateIndex], ct);

        // ── Partial unique index: one execution per (clientId, sessionId, date) ──────
        var partialFilter =
            Builders<SessionExecution>.Filter.Exists(e => e.SessionId)
            & Builders<SessionExecution>.Filter.Exists(e => e.Date);

        var uniqueIndex = new CreateIndexModel<SessionExecution>(
            Builders<SessionExecution>.IndexKeys
                .Ascending(e => e.ClientId)
                .Ascending(e => e.SessionId)
                .Ascending(e => e.Date),
            new CreateIndexOptions<SessionExecution>
            {
                Name = "idx_sessionexecution_clientId_sessionId_date_unique",
                Unique = true,
                PartialFilterExpression = partialFilter
            });

        await indexes.CreateOneAsync(uniqueIndex, cancellationToken: ct);
    }
}
