using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.ClientTraining;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Creates MongoDB indexes and runs one-time, idempotent data-migration backfills
/// at application startup (see the #837 migration methods near the bottom of this
/// file for the schema-on-read retirement).
/// </summary>
/// <remarks>
/// Registered in <c>Program.cs</c> as a plain <c>AddSingleton</c>, NOT
/// <c>AddHostedService</c>. <see cref="StartAsync"/> is invoked explicitly and
/// awaited immediately before <c>app.Run()</c> — deliberately NOT via the
/// <see cref="IHostedService"/> pipeline. Hosted services start sequentially in
/// registration order, and the framework's own web-hosting service (which starts
/// Kestrel listening) is registered ahead of anything user code adds afterwards —
/// so wiring this class via <c>AddHostedService</c> would let Kestrel begin
/// accepting requests before (or concurrently with) this migration completing.
/// The data-migration piece specifically MUST finish before any request can read
/// a legacy document: #837 deleted the graceful request-time
/// <c>WithBackfilledSections</c> fallback, and the document types carry no
/// <c>[BsonIgnoreExtraElements]</c>, so a request racing an unfinished migration
/// throws <c>BsonSerializationException</c> instead of self-healing. This class
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
    /// Creates all required MongoDB indexes and runs the one-time #837 migration
    /// backfills. Must be awaited to completion before the app serves any request —
    /// see the class-level remarks and the explicit call site in <c>Program.cs</c>.
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
        await CreateSessionLockIndexes(cancellationToken);
        await CreateWorkoutTemplateIndexes(cancellationToken);

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
        // One-time retire-schema-on-read migration (#837), BEFORE any typed read of
        // TrainingPlans elsewhere in this initializer or the app: legacy embedded
        // TrainingSession documents that still carry a flat `exercises` field (and no
        // C# LegacyExercises property to bind it) would throw a BSON deserialization
        // error the moment anything reads them through the typed collection. Idempotent —
        // safe to run on every boot.
        await BackfillTrainingPlanSections(ct);

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
        // One-time retire-schema-on-read migration (#837): legacy WorkoutLog documents
        // that still carry a flat `exercises` field (and no C# LegacyExercises property to
        // bind it) would throw a BSON deserialization error the moment anything reads them
        // through the typed collection below. Idempotent — safe to run on every boot.
        await BackfillWorkoutLogSections(ct);

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
            var completedDate = WorkoutLog.ToCompletionDateUtc(sourceInstant);

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
        //
        //     Pre-check: run a server-side $group aggregation to find duplicate triplets
        //     before pulling any documents into memory. This avoids a full collection scan
        //     on every boot when — as is almost always the case — there are no duplicates.
        var completedWithKeyFilter =
            Builders<WorkoutLog>.Filter.Eq(w => w.IsCompleted, true)
            & Builders<WorkoutLog>.Filter.Exists(w => w.PlanId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.SessionId)
            & Builders<WorkoutLog>.Filter.Exists(w => w.CompletedDate);

        // Server-side aggregation: $match → $group by triplet with count → $match count > 1.
        // Stops after the first duplicate found ($limit 1) so the pre-check is cheap even on
        // large collections.  Result type is BsonDocument — we only need to know the count.
        var dupCheckResult = await _mongo.WorkoutLogs
            .Aggregate()
            .Match(completedWithKeyFilter)
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument
                    {
                        { "planId",        "$planId" },
                        { "sessionId",     "$sessionId" },
                        { "completedDate", "$completedDate" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Match(new BsonDocument("count", new BsonDocument("$gt", 1)))
            .Limit(1)
            .ToListAsync(ct);

        var hasDuplicates = dupCheckResult.Count > 0;

        var deleteCount = 0;

        if (hasDuplicates)
        {
            // At least one duplicate triplet exists — load only the affected documents.
            using var dedupCursor = await _mongo.WorkoutLogs.FindAsync(
                completedWithKeyFilter, cancellationToken: ct);

            var allCompleted = await dedupCursor.ToListAsync(ct);

            var groups = allCompleted
                .GroupBy(l => (l.PlanId, l.SessionId, l.CompletedDate))
                .Where(g => g.Count() > 1);

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
        // One-time retire-schema-on-read migration (#837). Must run AFTER
        // BackfillTrainingPlanSections (called from CreateTrainingPlanIndexes, which runs
        // earlier in StartAsync) — resolving the effective per-section completion map below
        // requires reading TrainingPlans through the typed collection, which is only safe
        // once every embedded TrainingSession has been migrated off the legacy flat shape.
        // Idempotent — safe to run on every boot.
        await BackfillTrainingCompletionVersionAndSections(ct);

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

    private async Task CreateWorkoutTemplateIndexes(CancellationToken ct)
    {
        var indexes = _mongo.WorkoutTemplates.Indexes;

        // Unique index on externalId for API lookups and MongoSeeder's per-document dedupe.
        var externalIdIndex = new CreateIndexModel<WorkoutTemplate>(
            Builders<WorkoutTemplate>.IndexKeys.Ascending(t => t.ExternalId),
            new CreateIndexOptions { Name = "idx_workouttemplate_externalId", Unique = true });

        // Index on ownerId for per-trainer list queries (mirrors SectionTemplate's ownerTrainerId).
        var ownerIndex = new CreateIndexModel<WorkoutTemplate>(
            Builders<WorkoutTemplate>.IndexKeys.Ascending(t => t.OwnerId),
            new CreateIndexOptions { Name = "idx_workouttemplate_ownerId" });

        await indexes.CreateManyAsync([externalIdIndex, ownerIndex], ct);
    }

    // ── #837: retire plan/workout/completion schema-on-read ──────────────────────
    //
    // The three read-time backfills these endpoints used to perform on every request
    // (TrainingSession.WithBackfilledSections, WorkoutLog.WithBackfilledSections, and the
    // request-time CompletedExerciseIdsBySection seed in MarkExerciseIncompleteEndpoint)
    // are replaced by these one-time, idempotent boot migrations. All three operate
    // directly on raw BSON where the legacy shape includes a field with no corresponding
    // C# property (the `exercises` flat list) — reading such a document through the typed
    // collection would throw a BSON deserialization error. This means the migration must
    // complete BEFORE any request can be served, not merely before the other private
    // methods in this class run their own typed reads — see the class-level remarks
    // above and Program.cs's explicit pre-`app.Run()` invocation, which is what actually
    // provides that guarantee (this class is no longer wired via `AddHostedService`).

    /// <summary>
    /// Backfills every embedded <see cref="TrainingSession"/> across all <see cref="TrainingPlan"/>
    /// documents that still carries the legacy flat <c>exercises</c> field: synthesizes a single
    /// "Hlavní" section wrapping the flat exercises when <c>sections</c> is empty, then <c>$unset</c>s
    /// the legacy field. A session that already has <c>sections</c> populated (with a stale
    /// <c>exercises</c> field left over from an earlier partial write) only has the legacy field
    /// stripped — its modern <c>sections</c> data is left untouched.
    /// </summary>
    private async Task BackfillTrainingPlanSections(CancellationToken ct)
    {
        var rawPlans = _mongo.TrainingPlans.Database.GetCollection<BsonDocument>(
            _mongo.TrainingPlans.CollectionNamespace.CollectionName);

        // Candidate docs: any embedded session under any week still carries the legacy flat
        // `exercises` field. Mongo matches dotted paths across nested arrays automatically.
        var legacyFilter = new BsonDocument("weeks.sessions.exercises", new BsonDocument("$exists", true));

        using var cursor = await rawPlans.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var migratedPlanCount = 0;
        var migratedSessionCount = 0;

        foreach (var planDoc in candidates)
        {
            var planModified = false;

            if (!planDoc.TryGetValue("weeks", out var weeksValue) || weeksValue is not BsonArray weeks)
                continue;

            foreach (var weekValue in weeks)
            {
                if (weekValue is not BsonDocument week) continue;
                if (!week.TryGetValue("sessions", out var sessionsValue) || sessionsValue is not BsonArray sessions)
                    continue;

                foreach (var sessionValue in sessions)
                {
                    if (sessionValue is not BsonDocument session) continue;
                    if (!session.Contains("exercises")) continue;

                    var legacyExercises = session["exercises"] as BsonArray ?? [];
                    var sectionsIsEmpty = !session.TryGetValue("sections", out var sectionsValue)
                                           || sectionsValue is not BsonArray existingSections
                                           || existingSections.Count == 0;

                    if (sectionsIsEmpty && legacyExercises.Count > 0)
                    {
                        var synthesizedSection = new BsonDocument
                        {
                            { "sectionId", new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard) },
                            { "order", 0 },
                            { "name", "Hlavní" },
                            { "exercises", legacyExercises }
                        };
                        session["sections"] = new BsonArray { synthesizedSection };
                        migratedSessionCount++;
                    }

                    session.Remove("exercises");
                    planModified = true;
                }
            }

            if (planModified)
            {
                await rawPlans.ReplaceOneAsync(
                    Builders<BsonDocument>.Filter.Eq("_id", planDoc["_id"]),
                    planDoc,
                    cancellationToken: ct);
                migratedPlanCount++;
            }
        }

        if (migratedPlanCount > 0)
        {
            _logger.LogInformation(
                "TrainingPlan sections backfill: migrated {SessionCount} legacy session(s) across " +
                "{PlanCount} plan(s) to the sections shape",
                migratedSessionCount, migratedPlanCount);
        }
    }

    /// <summary>
    /// Backfills every <see cref="WorkoutLog"/> document that still carries the legacy flat
    /// <c>exercises</c> field: synthesizes a single "Hlavní" section wrapping the flat exercises
    /// (carrying over the session-level <c>wodResult</c>, if any) when <c>sections</c> is empty,
    /// then <c>$unset</c>s the legacy field.
    /// </summary>
    private async Task BackfillWorkoutLogSections(CancellationToken ct)
    {
        var rawLogs = _mongo.WorkoutLogs.Database.GetCollection<BsonDocument>(
            _mongo.WorkoutLogs.CollectionNamespace.CollectionName);

        var legacyFilter = new BsonDocument("exercises", new BsonDocument("$exists", true));

        using var cursor = await rawLogs.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var migratedCount = 0;

        foreach (var logDoc in candidates)
        {
            var legacyExercises = logDoc["exercises"] as BsonArray ?? [];
            var sectionsIsEmpty = !logDoc.TryGetValue("sections", out var sectionsValue)
                                   || sectionsValue is not BsonArray existingSections
                                   || existingSections.Count == 0;

            if (sectionsIsEmpty && legacyExercises.Count > 0)
            {
                var synthesizedSection = new BsonDocument
                {
                    { "sectionId", new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard) },
                    { "order", 0 },
                    { "name", "Hlavní" },
                    { "exercises", legacyExercises }
                };

                // Session-level WodResult (if present) carries over onto the synthesized
                // section, mirroring the retired WorkoutLog.WithBackfilledSections() behaviour.
                if (logDoc.TryGetValue("wodResult", out var wodResult) && wodResult is not BsonNull)
                    synthesizedSection["wodResult"] = wodResult;

                logDoc["sections"] = new BsonArray { synthesizedSection };
            }

            logDoc.Remove("exercises");

            await rawLogs.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", logDoc["_id"]),
                logDoc,
                cancellationToken: ct);

            migratedCount++;
        }

        if (migratedCount > 0)
        {
            _logger.LogInformation(
                "WorkoutLog sections backfill: migrated {Count} legacy log(s) to the sections shape",
                migratedCount);
        }
    }

    /// <summary>
    /// Two-part <see cref="TrainingCompletion"/> backfill:
    /// <list type="number">
    ///   <item><description>
    ///     Version — legacy documents predating the <c>Version</c> field deserialize to the C#
    ///     initializer value (1, not 0), so an <c>Eq(version, 0)</c> filter would never match
    ///     them (a previously documented incident). Targets absent-Version docs explicitly via
    ///     <c>$exists:false</c> and sets the same concrete value (1) so a subsequent
    ///     <c>Eq(version, existing.Version)</c> optimistic-concurrency filter matches the
    ///     persisted document instead of silently failing every update with a 409.
    ///   </description></item>
    ///   <item><description>
    ///     CompletedExerciseIdsBySection — reproduces
    ///     <see cref="TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection"/> exactly
    ///     (first matching section wins; ids no longer present in the resolved session are
    ///     dropped). Not self-contained: the completion carries <c>SessionId</c> but no
    ///     <c>PlanId</c>, so the owning <see cref="TrainingSession"/> must be resolved from the
    ///     <c>trainingPlans</c> collection by (ClientId, SessionId) — TrainingCompletion.ClientId
    ///     and TrainingPlan.ClientId are both ClientProfile.PublicId, so they compare directly.
    ///     When no plan/session resolves (deleted or restructured plan), the document is left
    ///     with a null map rather than throwing — read sites tolerate a null map. If a client
    ///     has two plans that happen to share a SessionId (should not occur in practice, but
    ///     not structurally prevented), the most-recently-updated plan's session wins — see
    ///     the tie-break comment at the <c>sessionLookup</c> construction below. That ambiguity
    ///     cannot cause data loss: the flat <c>CompletedExerciseIds</c> mirror is untouched
    ///     either way.
    ///   </description></item>
    /// </list>
    /// </summary>
    private async Task BackfillTrainingCompletionVersionAndSections(CancellationToken ct)
    {
        // (a) Version backfill.
        var versionMissingFilter = Builders<TrainingCompletion>.Filter.Exists(c => c.Version, exists: false);
        var versionUpdateResult = await _mongo.TrainingCompletions.UpdateManyAsync(
            versionMissingFilter,
            Builders<TrainingCompletion>.Update.Set(c => c.Version, 1),
            cancellationToken: ct);

        if (versionUpdateResult.ModifiedCount > 0)
        {
            _logger.LogInformation(
                "TrainingCompletion version backfill: set version=1 on {Count} field-absent document(s)",
                versionUpdateResult.ModifiedCount);
        }

        // (b) CompletedExerciseIdsBySection backfill.
        var bySectionMissingFilter = Builders<TrainingCompletion>.Filter.Exists(
            c => c.CompletedExerciseIdsBySection, exists: false);

        using var legacyCursor = await _mongo.TrainingCompletions.FindAsync(bySectionMissingFilter, cancellationToken: ct);
        var legacyCompletions = await legacyCursor.ToListAsync(ct);

        if (legacyCompletions.Count == 0)
            return;

        var migratedCount = 0;
        var unresolvedCount = 0;

        foreach (var clientGroup in legacyCompletions.GroupBy(c => c.ClientId))
        {
            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientGroup.Key);
            using var planCursor = await _mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var clientPlans = await planCursor.ToListAsync(ct);

            // Tie-break for the (rare, non-data-loss) case where a client has two plans
            // sharing a SessionId with divergent section layouts: order plans by recency
            // (DateUpdated, falling back to DateCreated) BEFORE flattening to sessions, so
            // GroupBy/First deterministically prefers the most-recently-updated plan's
            // session rather than whichever plan happened to sort first out of Mongo.
            // LINQ's GroupBy preserves first-encountered order within each group, and
            // SelectMany preserves the source (plan) ordering — so ordering clientPlans
            // descending by recency here is sufficient; no need to re-sort inside each
            // group. This only affects section ATTRIBUTION for the derived
            // CompletedExerciseIdsBySection map — the flat CompletedExerciseIds mirror is
            // never touched, so a wrong pick here is not data loss, only a (very rare)
            // mis-attributed section key that self-corrects if the stale plan is ever
            // resolved differently on a later pass.
            var sessionLookup = clientPlans
                .OrderByDescending(p => p.DateUpdated ?? p.DateCreated)
                .SelectMany(p => p.Weeks.SelectMany(w => w.Sessions))
                .GroupBy(s => s.SessionId)
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var completion in clientGroup)
            {
                if (!sessionLookup.TryGetValue(completion.SessionId, out var session))
                {
                    // Session no longer resolvable (plan deleted/restructured) — leave
                    // CompletedExerciseIdsBySection null for this document. The flat
                    // CompletedExerciseIds mirror is untouched/preserved, and read sites
                    // handle a null map without throwing.
                    unresolvedCount++;
                    continue;
                }

                var effective = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(completion, session);
                var bySection = effective.ToDictionary(kvp => kvp.Key.ToString(), kvp => kvp.Value.ToList());

                await _mongo.TrainingCompletions.UpdateOneAsync(
                    Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completion.ExternalId),
                    Builders<TrainingCompletion>.Update.Set(c => c.CompletedExerciseIdsBySection, bySection),
                    cancellationToken: ct);

                migratedCount++;
            }
        }

        if (migratedCount > 0 || unresolvedCount > 0)
        {
            _logger.LogInformation(
                "TrainingCompletion section backfill: populated CompletedExerciseIdsBySection on " +
                "{Migrated} document(s); {Unresolved} document(s) skipped (session no longer resolvable)",
                migratedCount, unresolvedCount);
        }
    }
}
