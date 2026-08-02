using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
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
    /// Test-only hook (#841 M1). Invoked with (ClientId, SessionId, Date) immediately after
    /// the plan-bound up-front existence check in <see cref="MigrateSessionExecutionsAsync"/>
    /// has already returned "not found", but before that key's own <c>InsertOneAsync</c>
    /// runs. Lets integration tests deterministically simulate the TOCTOU race this method
    /// guards against — a concurrent live write landing at the same identity between the
    /// check and the insert — without depending on real thread timing. Always <c>null</c> in
    /// production.
    /// </summary>
    internal Func<Guid, Guid, DateTime, Task>? BeforePlanBoundInsertAsync { get; set; }

    /// <summary>
    /// Test-only hook (#841 M1), same purpose as <see cref="BeforePlanBoundInsertAsync"/> but
    /// for the ad-hoc (ExternalId-identity) insert path. Invoked with the WorkoutLog's
    /// ExternalId. Always <c>null</c> in production.
    /// </summary>
    internal Func<Guid, Task>? BeforeAdHocInsertAsync { get; set; }

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

        // #857 step 1-3: MUST run before every Create*Indexes call below. CreateManyAsync
        // implicitly creates a missing collection, so if any index-creation method ran first,
        // it would leave an empty target collection and the rename below would then throw
        // NamespaceExists(48). This migration is a no-op on a fresh database (neither legacy
        // physical collection exists yet).
        await MigrateWorkoutTemplateCollectionSwapAsync(cancellationToken);

        // #857 (completion-field rename): MUST also run before every Create*Indexes call
        // below. Neither SessionExecution nor TrainingCompletion carries
        // [BsonIgnoreExtraElements], so once the renamed BsonElement("completedWorkoutIds")
        // is live on the C# type, a legacy on-disk document that still carries the old
        // "completedSectionIds" element name is an unmapped extra element for the typed
        // collection — the first typed read (BackfillTrainingCompletionVersionAndSections,
        // called from CreateTrainingCompletionIndexes; the SessionExecution dedup pass,
        // called from CreateSessionExecutionIndexes) would throw a BSON deserialization
        // error. This migration is a no-op on a fresh database and a no-op on any database
        // that has already run it once (idempotent $exists guard).
        await MigrateCompletedWorkoutIdsRenameAsync(cancellationToken);

        // #857 step 6: MUST also run before every Create*Indexes call below. Neither
        // WorkoutLog nor SessionExecution carries [BsonIgnoreExtraElements], so once the
        // renamed BsonElement("workouts")/BsonElement("workoutId") are live on the C# types,
        // a legacy on-disk document that still carries the old "sections"/"sectionId" element
        // names is an unmapped extra element for the typed collection — the first typed read
        // (BackfillWorkoutLogSections, called from CreateWorkoutLogIndexes; the SessionExecution
        // dedup pass, called from CreateSessionExecutionIndexes) would throw a BSON
        // deserialization error. This migration is a no-op on a fresh database and a no-op on
        // any database that has already run it once (idempotent $exists guard).
        await MigrateWorkoutSectionsToWorkoutsRenameAsync(cancellationToken);

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

        _logger.LogInformation("MongoDB indexes created successfully");
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    // ── #857 step 1-3: swap the workoutTemplates/sectionTemplates physical collections ──
    //
    // Vocabulary rename (section -> workout): the C# type formerly named SectionTemplate
    // (a single reusable workout, DefaultExercises[]) is now WorkoutTemplate, and the type
    // formerly named WorkoutTemplate (a whole reusable session skeleton, Sections[]/now
    // Workouts[]) is now SessionTemplate. The physical Mongo collections must swap identity
    // to match: the OLD "workoutTemplates" collection's documents become the NEW
    // SessionTemplate collection, and the OLD "sectionTemplates" collection's documents
    // become the NEW WorkoutTemplate collection.
    //
    // Ordering is load-bearing — reversed, step 2 fails on an existing target:
    //   1. renameCollection workoutTemplates -> sessionTemplates
    //   2. renameCollection sectionTemplates -> workoutTemplates
    //
    // MUST run before ANY Create*Indexes call touches either collection (see the call site
    // in StartAsync) — CreateManyAsync implicitly creates a missing collection, so an index
    // pass ahead of the renames would leave an empty target and renameCollection would then
    // throw NamespaceExists(48).
    //
    // Idempotency (design-review GATE 2c): each rename is guarded on "source exists AND
    // target absent". On a fresh database neither legacy collection exists, so both guards
    // skip and this method is a complete no-op. On a pre-857 database the first boot performs
    // both renames; a second boot finds the source already renamed away (or the target
    // already populated) and skips — the whole migration runs cleanly twice (AC bullet 9).
    //
    // Index carry-over (design-review GATE 2b): MongoDB's renameCollection carries the
    // source collection's indexes across unchanged. Post-swap, the physical "sessionTemplates"
    // collection still holds the stale idx_workouttemplate_* names (created against the OLD
    // WorkoutTemplate type) while CreateSessionTemplateIndexes below requests idx_sessiontemplate_*
    // over the same keys -> IndexOptionsConflict -> boot throws. Symmetrically for
    // "workoutTemplates" holding stale idx_sectiontemplate_* names. Step 3 drops the stale
    // names before CreateWorkoutTemplateIndexes/CreateSessionTemplateIndexes run later in
    // StartAsync.
    /// <summary>
    /// One-time, idempotent migration (#857): swaps the physical <c>workoutTemplates</c> and
    /// <c>sectionTemplates</c> Mongo collections so their contents land under the renamed
    /// <see cref="SessionTemplate"/> and <see cref="WorkoutTemplate"/> types, then drops the
    /// stale carried-over indexes. See the remarks above this method for the full ordering
    /// and idempotency contract. Must complete before any <c>Create*Indexes</c> method runs —
    /// see the call site in <see cref="StartAsync"/>.
    /// </summary>
    private async Task MigrateWorkoutTemplateCollectionSwapAsync(CancellationToken ct)
    {
        var database = _mongo.SessionTemplates.Database;

        // Step 1: workoutTemplates -> sessionTemplates
        await RenameCollectionIfNeededAsync(database, MongoCollections.WorkoutTemplates, MongoCollections.SessionTemplates, ct);

        // Step 2: sectionTemplates -> workoutTemplates
        await RenameCollectionIfNeededAsync(database, MongoCollections.LegacySectionTemplates, MongoCollections.WorkoutTemplates, ct);

        // Step 3: drop the stale renamed-in indexes before CreateWorkoutTemplateIndexes /
        // CreateSessionTemplateIndexes (later in StartAsync) create the correctly-named ones.
        await TryDropIndexAsync(_mongo.SessionTemplates.Indexes, "idx_workouttemplate_externalId", ct);
        await TryDropIndexAsync(_mongo.SessionTemplates.Indexes, "idx_workouttemplate_ownerId", ct);
        await TryDropIndexAsync(_mongo.WorkoutTemplates.Indexes, "idx_sectiontemplate_externalId", ct);
        await TryDropIndexAsync(_mongo.WorkoutTemplates.Indexes, "idx_sectiontemplate_ownerTrainerId", ct);
    }

    /// <summary>
    /// Renames <paramref name="source"/> to <paramref name="target"/> only when
    /// <paramref name="source"/> currently exists AND <paramref name="target"/> does not —
    /// the guard that makes the swap idempotent across repeated boots (see remarks on
    /// <see cref="MigrateWorkoutTemplateCollectionSwapAsync"/>).
    /// </summary>
    private static async Task RenameCollectionIfNeededAsync(IMongoDatabase database, string source, string target, CancellationToken ct)
    {
        using var nameCursor = await database.ListCollectionNamesAsync(cancellationToken: ct);
        var existingNames = await nameCursor.ToListAsync(ct);

        if (!existingNames.Contains(source) || existingNames.Contains(target))
        {
            return;
        }

        await database.RenameCollectionAsync(source, target, cancellationToken: ct);
    }

    // ── #857 (completion-field rename): completedSectionIds -> completedWorkoutIds ────
    //
    // Vocabulary rename (section -> workout): SessionExecution.CompletedSectionIds and
    // TrainingCompletion.CompletedSectionIds are renamed to CompletedWorkoutIds to match the
    // TrainingWorkout (formerly TrainingSection) vocabulary already in force elsewhere on
    // these documents. Values are unchanged — this is a pure field rename, no resolution
    // logic (unlike the CompletedExerciseIdsBySection backfill, which stays untouched).
    //
    // MUST run before ANY typed read of either collection (see the call site in StartAsync)
    // — neither type carries [BsonIgnoreExtraElements], so a legacy document still holding
    // the old "completedSectionIds" element name is an unmapped extra element once the C#
    // property maps to "completedWorkoutIds", and the driver throws on deserialization
    // instead of silently ignoring it.
    //
    // Idempotency: each rename is filtered on the OLD element name existing ($exists).
    // On a fresh database, or a database that already ran this migration, the filter matches
    // zero documents and UpdateManyAsync is a no-op — the whole migration runs cleanly on
    // every boot.
    /// <summary>
    /// One-time, idempotent migration (#857): <c>$rename</c>s the <c>completedSectionIds</c>
    /// BSON element to <c>completedWorkoutIds</c> on both the <c>sessionExecutions</c> and
    /// <c>trainingCompletions</c> collections. Pure field rename — values are unchanged. See
    /// the remarks above this method and the call site in <see cref="StartAsync"/> for why
    /// this must run before any typed read of either collection.
    /// </summary>
    private async Task MigrateCompletedWorkoutIdsRenameAsync(CancellationToken ct)
    {
        var executionsOldFieldFilter = new BsonDocumentFilterDefinition<SessionExecution>(
            new BsonDocument("completedSectionIds", new BsonDocument("$exists", true)));

        var executionsRenameResult = await _mongo.SessionExecutions.UpdateManyAsync(
            executionsOldFieldFilter,
            Builders<SessionExecution>.Update.Rename("completedSectionIds", "completedWorkoutIds"),
            cancellationToken: ct);

        if (executionsRenameResult.ModifiedCount > 0)
        {
            _logger.LogInformation(
                "SessionExecution field rename: renamed completedSectionIds -> completedWorkoutIds " +
                "on {Count} document(s)",
                executionsRenameResult.ModifiedCount);
        }

        var completionsOldFieldFilter = new BsonDocumentFilterDefinition<TrainingCompletion>(
            new BsonDocument("completedSectionIds", new BsonDocument("$exists", true)));

        var completionsRenameResult = await _mongo.TrainingCompletions.UpdateManyAsync(
            completionsOldFieldFilter,
            Builders<TrainingCompletion>.Update.Rename("completedSectionIds", "completedWorkoutIds"),
            cancellationToken: ct);

        if (completionsRenameResult.ModifiedCount > 0)
        {
            _logger.LogInformation(
                "TrainingCompletion field rename: renamed completedSectionIds -> completedWorkoutIds " +
                "on {Count} document(s)",
                completionsRenameResult.ModifiedCount);
        }
    }

    // ── #857 step 6: sections/sectionId -> workouts/workoutId on WorkoutLog and ─────
    // SessionExecutionPerformance ────────────────────────────────────────────────────
    //
    // Vocabulary rename (section -> workout): WorkoutLog.Sections and
    // SessionExecutionPerformance.Sections are renamed to Workouts (BSON "sections" ->
    // "workouts"), and the embedded WorkoutSection type (now LoggedWorkout) has its
    // SectionId renamed to WorkoutId (BSON "sectionId" -> "workoutId").
    //
    // $rename CANNOT reach the nested "sectionId" field inside each element of the
    // "sections"/"workouts" array — MongoDB's $rename operator only renames a field at a
    // fixed path, and array elements do not have a fixed path. Top-level "sections" (a
    // direct field on workoutLogs, and "performance.sections" — a single embedded
    // sub-document, not an array, on sessionExecutions) COULD be $rename'd directly, but
    // doing so would leave every array element still carrying the old "sectionId" key
    // alongside a document that otherwise deserializes through the renamed C# property —
    // since neither type carries [BsonIgnoreExtraElements], that stale nested key would
    // become a permanent unmapped extra element. So this migration reads each candidate
    // document as a raw BsonDocument (mirroring BackfillWorkoutLogSections/
    // BackfillTrainingPlanSections below), rewrites every array element in place (removing
    // the old "sectionId" key and adding "workoutId" with the same value), renames the
    // container field, and writes the whole document back via ReplaceOneAsync.
    //
    // MUST run before ANY typed read of either collection (see the call site in
    // StartAsync) — same BsonSerializationException risk as MigrateCompletedWorkoutIdsRenameAsync
    // above.
    //
    // Idempotency: each collection's candidate filter matches only documents that still
    // carry the OLD top-level field ("sections" / "performance.sections" respectively). On
    // a fresh database, or a database that already ran this migration, the filter matches
    // zero documents and the loop body never runs — the whole migration runs cleanly on
    // every boot.
    /// <summary>
    /// One-time, idempotent migration (#857 step 6): rewrites the <c>sections</c> BSON
    /// array to <c>workouts</c> on both the <c>workoutLogs</c> collection (top-level) and
    /// the <c>sessionExecutions</c> collection (nested under <c>performance</c>), and
    /// renames the <c>sectionId</c> element to <c>workoutId</c> within every array element.
    /// Cannot use <c>$rename</c> alone — see the remarks above this method and the call
    /// site in <see cref="StartAsync"/> for why this must run before any typed read of
    /// either collection.
    /// </summary>
    private async Task MigrateWorkoutSectionsToWorkoutsRenameAsync(CancellationToken ct)
    {
        await MigrateWorkoutLogSectionsToWorkoutsAsync(ct);
        await MigrateSessionExecutionPerformanceSectionsToWorkoutsAsync(ct);
    }

    /// <summary>
    /// Rewrites the top-level <c>sections</c> array on every <c>workoutLogs</c> document
    /// that still carries it: renames the container to <c>workouts</c> and renames
    /// <c>sectionId</c> to <c>workoutId</c> within every element. See the remarks above
    /// <see cref="MigrateWorkoutSectionsToWorkoutsRenameAsync"/> for why this cannot use
    /// <c>$rename</c> alone.
    /// </summary>
    private async Task MigrateWorkoutLogSectionsToWorkoutsAsync(CancellationToken ct)
    {
        var rawLogs = _mongo.WorkoutLogs.Database.GetCollection<BsonDocument>(
            _mongo.WorkoutLogs.CollectionNamespace.CollectionName);

        var legacyFilter = new BsonDocument("sections", new BsonDocument("$exists", true));

        using var cursor = await rawLogs.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var migratedCount = 0;

        foreach (var logDoc in candidates)
        {
            if (!logDoc.TryGetValue("sections", out var sectionsValue) || sectionsValue is not BsonArray sections)
            {
                continue;
            }

            RenameSectionIdWithinEachElement(sections);

            logDoc["workouts"] = sections;
            logDoc.Remove("sections");

            await rawLogs.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", logDoc["_id"]),
                logDoc,
                cancellationToken: ct);

            migratedCount++;
        }

        if (migratedCount > 0)
        {
            _logger.LogInformation(
                "WorkoutLog field rename: renamed sections -> workouts (and nested sectionId -> " +
                "workoutId) on {Count} document(s)",
                migratedCount);
        }
    }

    /// <summary>
    /// Rewrites the nested <c>performance.sections</c> array on every <c>sessionExecutions</c>
    /// document that still carries it: renames the container to <c>performance.workouts</c> and
    /// renames <c>sectionId</c> to <c>workoutId</c> within every element. See the remarks above
    /// <see cref="MigrateWorkoutSectionsToWorkoutsRenameAsync"/> for why this cannot use
    /// <c>$rename</c> alone.
    /// </summary>
    private async Task MigrateSessionExecutionPerformanceSectionsToWorkoutsAsync(CancellationToken ct)
    {
        var rawExecutions = _mongo.SessionExecutions.Database.GetCollection<BsonDocument>(
            _mongo.SessionExecutions.CollectionNamespace.CollectionName);

        var legacyFilter = new BsonDocument("performance.sections", new BsonDocument("$exists", true));

        using var cursor = await rawExecutions.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var migratedCount = 0;

        foreach (var executionDoc in candidates)
        {
            if (!executionDoc.TryGetValue("performance", out var performanceValue) || performanceValue is not BsonDocument performance)
            {
                continue;
            }

            if (!performance.TryGetValue("sections", out var sectionsValue) || sectionsValue is not BsonArray sections)
            {
                continue;
            }

            RenameSectionIdWithinEachElement(sections);

            performance["workouts"] = sections;
            performance.Remove("sections");

            await rawExecutions.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", executionDoc["_id"]),
                executionDoc,
                cancellationToken: ct);

            migratedCount++;
        }

        if (migratedCount > 0)
        {
            _logger.LogInformation(
                "SessionExecution field rename: renamed performance.sections -> performance.workouts " +
                "(and nested sectionId -> workoutId) on {Count} document(s)",
                migratedCount);
        }
    }

    /// <summary>
    /// Renames the <c>sectionId</c> element to <c>workoutId</c> in place on every
    /// <see cref="BsonDocument"/> element of <paramref name="sections"/>. Non-document
    /// elements or elements missing <c>sectionId</c> are left untouched.
    /// </summary>
    private static void RenameSectionIdWithinEachElement(BsonArray sections)
    {
        foreach (var sectionValue in sections)
        {
            if (sectionValue is not BsonDocument section)
            {
                continue;
            }

            if (!section.TryGetValue("sectionId", out var sectionId))
            {
                continue;
            }

            section.Remove("sectionId");
            section["workoutId"] = sectionId;
        }
    }

    // ── #840: standardise Mongo clientId on ApplicationUser.Id ───────────────────
    //
    // Canonical decision: every Mongo document's clientId field is ApplicationUser.Id.
    // The plan-side use of ClientProfile.PublicId (NutritionPlan, TrainingPlan,
    // TrainingCompletion, DayLog, MealLog, SessionLog, SessionLock) was incidental —
    // WorkoutLog and PersonalRecord already used ApplicationUser.Id and are untouched
    // by this migration.
    //
    // Deliberately NOT a constructor dependency: this class is registered as a plain
    // AddSingleton (see class remarks) and resolved directly from the ROOT service
    // provider in Program.cs and in FitnessApiFactoryTests — injecting a scoped
    // IApplicationDbContext into the constructor would break that resolution under
    // ASP.NET Core's scope validation. Program.cs instead resolves IApplicationDbContext
    // from the SAME pre-app.Run() scope used for StartAsync and passes it in here as a
    // plain method parameter.
    //
    // Idempotency (design-review MINOR-2): PublicId and UserId are both GUIDs, so shape
    // alone cannot distinguish a migrated document from an unmigrated one. The only safe
    // signal is "clientId currently equals an EXISTING ClientProfile.PublicId" — the
    // PublicId -> UserId map is built once from Postgres, then each collection is
    // rewritten via one UpdateMany per client, matched on the OLD PublicId value.
    // Already-migrated documents (clientId = UserId) never match Eq(clientId, publicId)
    // on a second run (UserId and PublicId are independent, non-overlapping GUID spaces
    // per ClientProfile), so a re-run mutates 0 documents, and a partial-interruption
    // re-run only touches the remaining un-migrated documents.
    //
    // Index safety: ClientProfile.PublicId and ClientProfile.UserId are both unique
    // per ClientProfile (enforced by Postgres unique constraints), so the PublicId ->
    // UserId map is a bijection over existing clients. Rewriting clientId via UpdateMany
    // relabels an entire client's document set from one unique value to another — it
    // never merges two clients' documents under one clientId — so the UNIQUE
    // (clientId, date, sessionId) index on TrainingCompletion cannot be violated
    // mid-migration.
    /// <summary>
    /// One-time, idempotent migration (#840): rewrites every Mongo document's clientId
    /// field from ClientProfile.PublicId to ApplicationUser.Id across NutritionPlan,
    /// TrainingPlan, TrainingCompletion, DayLog, MealLog, SessionLog, and SessionLock.
    /// Must be awaited to completion before the app serves any request — see the call
    /// site in <c>Program.cs</c>, invoked in the same pre-<c>app.Run()</c> scope as
    /// <see cref="StartAsync"/>.
    /// </summary>
    /// <param name="db">Relational database context — resolved from a DI scope by the
    /// caller (see class remarks on why this isn't a constructor dependency).</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task MigrateClientIdsAsync(IApplicationDbContext db, CancellationToken ct)
    {
        var profiles = await db.ClientProfiles
            .AsNoTracking()
            .Select(cp => new { cp.PublicId, cp.UserId })
            .ToListAsync(ct);

        if (profiles.Count == 0)
        {
            _logger.LogInformation("ClientId standardisation (#840): no ClientProfiles found, skipping");
            return;
        }

        var userIdByPublicId = profiles.ToDictionary(p => p.PublicId, p => p.UserId);

        var nutritionCount = await MigrateCollectionClientIdsAsync(_mongo.NutritionPlans, p => p.ClientId, userIdByPublicId, ct);
        var trainingCount = await MigrateCollectionClientIdsAsync(_mongo.TrainingPlans, p => p.ClientId, userIdByPublicId, ct);
        var completionCount = await MigrateCollectionClientIdsAsync(_mongo.TrainingCompletions, c => c.ClientId, userIdByPublicId, ct);
        var dayLogCount = await MigrateCollectionClientIdsAsync(_mongo.DayLogs, l => l.ClientId, userIdByPublicId, ct);
        var mealLogCount = await MigrateCollectionClientIdsAsync(_mongo.MealLogs, l => l.ClientId, userIdByPublicId, ct);
        var sessionLogCount = await MigrateCollectionClientIdsAsync(_mongo.SessionLogs, l => l.ClientId, userIdByPublicId, ct);
        var sessionLockCount = await MigrateCollectionClientIdsAsync(_mongo.SessionLocks, l => l.ClientId, userIdByPublicId, ct);

        var total = nutritionCount + trainingCount + completionCount + dayLogCount + mealLogCount + sessionLogCount + sessionLockCount;

        if (total > 0)
        {
            _logger.LogInformation(
                "ClientId standardisation (#840): rewrote {Total} document(s) to ApplicationUser.Id " +
                "(NutritionPlan={Nutrition}, TrainingPlan={Training}, TrainingCompletion={Completion}, " +
                "DayLog={DayLog}, MealLog={MealLog}, SessionLog={SessionLog}, SessionLock={SessionLock})",
                total, nutritionCount, trainingCount, completionCount, dayLogCount, mealLogCount, sessionLogCount, sessionLockCount);
        }
        else
        {
            _logger.LogInformation("ClientId standardisation (#840): no documents needed migration (already up to date)");
        }
    }

    /// <summary>
    /// Rewrites the clientId field of every document in <paramref name="collection"/> whose
    /// current value is a key in <paramref name="userIdByPublicId"/> (i.e. still a
    /// ClientProfile.PublicId) to the corresponding ApplicationUser.Id. One
    /// <see cref="UpdateManyModel{TDocument}"/> per client is batched into a single
    /// <c>BulkWriteAsync</c> round trip per collection. <c>IsOrdered = false</c> is safe here:
    /// each client's filter/update pair targets a disjoint set of documents (matched on that
    /// client's unique PublicId), so write order between clients never matters.
    /// </summary>
    private static async Task<long> MigrateCollectionClientIdsAsync<T>(
        IMongoCollection<T> collection,
        Expression<Func<T, Guid>> clientIdSelector,
        IReadOnlyDictionary<Guid, Guid> userIdByPublicId,
        CancellationToken ct)
    {
        var writes = new List<WriteModel<T>>(userIdByPublicId.Count);

        foreach (var (publicId, userId) in userIdByPublicId)
        {
            writes.Add(new UpdateManyModel<T>(
                Builders<T>.Filter.Eq(clientIdSelector, publicId),
                Builders<T>.Update.Set(clientIdSelector, userId)));
        }

        if (writes.Count == 0)
            return 0;

        var result = await collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);
        return result.ModifiedCount;
    }

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

        await indexes.CreateManyAsync([externalIdIndex, ownerIndex], ct);
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
    //
    // Same backfill → dedup → create-unique-index ordering as CreateWorkoutLogIndexes, so a
    // rare interrupted --migrate-session-executions run (or any future write bug) that leaves
    // more than one document per (clientId, sessionId, date) doesn't blow up index creation
    // with E11000. No backfill step is needed here — every SessionExecution write path always
    // sets Date at creation time (unlike legacy WorkoutLog.CompletedDate, which was backfilled
    // from CompletedAt) — but dedup is retained as defense in depth.
    /// <summary>
    /// Creates the SessionExecution indexes (ExternalId unique, ClientId+Date, and the
    /// partial-unique ClientId+SessionId+Date). <c>internal</c> rather than <c>private</c>
    /// solely so <c>SessionExecutionMigrationTests</c> can create these indexes directly in
    /// a dedicated per-test container without needing to call the full <see cref="StartAsync"/>
    /// (which also runs the unrelated #837 backfills) — see
    /// <c>InternalsVisibleTo("FitnessPlatform.Tests")</c> elsewhere in this assembly.
    /// </summary>
    internal async Task CreateSessionExecutionIndexes(CancellationToken ct)
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

        // ── Dedup, BEFORE creating the partial unique index ──────────────────────────
        var keyedFilter =
            Builders<SessionExecution>.Filter.Exists(e => e.SessionId)
            & Builders<SessionExecution>.Filter.Exists(e => e.Date);

        var dupCheckResult = await _mongo.SessionExecutions
            .Aggregate()
            .Match(keyedFilter)
            .Group(new BsonDocument
            {
                { "_id", new BsonDocument
                    {
                        { "clientId",  "$clientId" },
                        { "sessionId", "$sessionId" },
                        { "date",      "$date" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            })
            .Match(new BsonDocument("count", new BsonDocument("$gt", 1)))
            .Limit(1)
            .ToListAsync(ct);

        if (dupCheckResult.Count > 0)
        {
            using var dedupCursor = await _mongo.SessionExecutions.FindAsync(keyedFilter, cancellationToken: ct);
            var all = await dedupCursor.ToListAsync(ct);

            var groups = all
                .GroupBy(e => (e.ClientId, e.SessionId, e.Date))
                .Where(g => g.Count() > 1);

            var deleteCount = 0;

            foreach (var group in groups)
            {
                // Keep the most "authoritative" document: prefer Completed status, then most
                // recently updated. Delete the rest.
                var ordered = group
                    .OrderByDescending(e => e.Status == SessionExecutionStatus.Completed)
                    .ThenByDescending(e => e.DateUpdated ?? e.DateCreated)
                    .ToList();

                var toDelete = ordered.Skip(1).Select(e => e.ExternalId).ToList();

                await _mongo.SessionExecutions.DeleteManyAsync(
                    Builders<SessionExecution>.Filter.In(e => e.ExternalId, toDelete),
                    cancellationToken: ct);

                deleteCount += toDelete.Count;
            }

            if (deleteCount > 0)
            {
                _logger.LogWarning(
                    "SessionExecution dedup: deleted {Count} duplicate document(s) before creating partial unique index",
                    deleteCount);
            }
        }

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

    // ── #841: migrate WorkoutLog + TrainingCompletion → SessionExecution ────────────
    //
    // PRODUCTION entrypoint: `dotnet run -- --migrate-session-executions` (see Program.cs),
    // mirroring the `--migrate-client-ids` (#840) one-shot CLI arg pattern — Render does not
    // set Database:RunMigrationsOnStartup, so this must be run once as an intentional deploy
    // step, not relied on via any startup gate.
    //
    // Identity / idempotency: a plan-bound execution's identity is (clientId, sessionId, date);
    // an ad-hoc (unplanned) execution's identity is its ExternalId (carried over 1:1 from the
    // source WorkoutLog). Before creating any document this method checks whether one already
    // exists at that identity and skips if so — a re-run after a full migration mutates 0
    // documents, and a re-run after a partial/interrupted migration only processes what's left.
    //
    // ExternalId carry-over: whenever a source WorkoutLog exists for a key (both-exist or
    // log-only), the new SessionExecution.ExternalId is set to that WorkoutLog's ExternalId —
    // NOT a freshly-generated Guid — so PersonalRecord.WorkoutLogId (and its unique
    // (workoutLogId, exerciseExternalId, setNumber) idempotency index) continue to resolve
    // without any PersonalRecord data migration. Completion-only keys (no source WorkoutLog,
    // hence no PersonalRecord could reference them) get a fresh ExternalId.
    /// <summary>
    /// One-time, idempotent migration (#841): merges every <see cref="WorkoutLog"/> and
    /// <see cref="TrainingCompletion"/> document into the unified <see cref="SessionExecution"/>
    /// collection. See the remarks above this method for the identity/idempotency contract.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Per-category counts of documents created/skipped, for CLI output.</returns>
    public async Task<(long Merged, long LogOnly, long CompletionOnly, long AdHoc, long Skipped)> MigrateSessionExecutionsAsync(
        CancellationToken ct)
    {
        var allLogs = await _mongo.WorkoutLogs.Find(Builders<WorkoutLog>.Filter.Empty).ToListAsync(ct);
        var allCompletions = await _mongo.TrainingCompletions.Find(Builders<TrainingCompletion>.Filter.Empty).ToListAsync(ct);

        long mergedCount = 0, logOnlyCount = 0, completionOnlyCount = 0, adHocCount = 0, skippedCount = 0;

        // Plan-bound logs keyed by (clientId, sessionId, date). When more than one log shares
        // a key (e.g. a stale draft alongside the finished one), prefer the completed log, then
        // the most recently updated — mirrors the dedup precedence used elsewhere in this file.
        var planBoundLogsByKey = allLogs
            .Where(l => l.SessionId.HasValue)
            .GroupBy(l => (l.ClientId, SessionId: l.SessionId!.Value, Date: l.CompletedDate ?? WorkoutLog.ToCompletionDateUtc(l.StartedAt)))
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(l => l.IsCompleted)
                       .ThenByDescending(l => l.DateUpdated ?? l.DateCreated)
                       .First());

        // TrainingCompletion's own historical unique index already guarantees at most one
        // document per (clientId, date, sessionId), so a plain ToDictionary is safe here.
        var completionsByKey = allCompletions
            .ToDictionary(c => (c.ClientId, SessionId: c.SessionId, Date: c.Date));

        var allKeys = planBoundLogsByKey.Keys.Union(completionsByKey.Keys).ToList();

        // Per-client (planId, TrainingSession) lookup, resolved once per client and cached —
        // mirrors the tie-break logic in BackfillTrainingCompletionVersionAndSections (prefer
        // the most-recently-updated plan's session when a client has more than one plan sharing
        // a SessionId).
        var sessionLookupByClient = new Dictionary<Guid, Dictionary<Guid, (Guid PlanId, TrainingSession Session)>>();

        async Task<Dictionary<Guid, (Guid PlanId, TrainingSession Session)>> GetClientSessionLookupAsync(Guid clientId)
        {
            if (sessionLookupByClient.TryGetValue(clientId, out var cached))
                return cached;

            var planFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId);
            using var planCursor = await _mongo.TrainingPlans.FindAsync(planFilter, cancellationToken: ct);
            var clientPlans = await planCursor.ToListAsync(ct);

            var lookup = clientPlans
                .OrderByDescending(p => p.DateUpdated ?? p.DateCreated)
                .SelectMany(p => p.Weeks.SelectMany(w => w.Sessions).Select(s => (Plan: p, Session: s)))
                .GroupBy(x => x.Session.SessionId)
                .ToDictionary(g => g.Key, g => (g.First().Plan.ExternalId, g.First().Session));

            sessionLookupByClient[clientId] = lookup;
            return lookup;
        }

        foreach (var key in allKeys)
        {
            var (clientId, sessionId, date) = key;

            var existingFilter = Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
                & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionId)
                & Builders<SessionExecution>.Filter.Eq(e => e.Date, date);

            if (await _mongo.SessionExecutions.Find(existingFilter).AnyAsync(ct))
            {
                skippedCount++;
                continue;
            }

            planBoundLogsByKey.TryGetValue(key, out var log);
            completionsByKey.TryGetValue(key, out var completion);

            var clientSessionLookup = await GetClientSessionLookupAsync(clientId);
            clientSessionLookup.TryGetValue(sessionId, out var resolved);

            SessionExecution execution;
            Action recordCategory;

            if (log is not null && completion is not null)
            {
                execution = BuildFromLog(log, clientId, sessionId, date);
                ApplyCompletionFlags(execution, completion);
                var isComplete = log.IsCompleted || (resolved.Session is not null && completion.IsSessionComplete(resolved.Session));
                execution.Status = isComplete ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial;
                recordCategory = () => mergedCount++;
            }
            else if (log is not null)
            {
                execution = BuildFromLog(log, clientId, sessionId, date);
                execution.Status = log.IsCompleted ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial;
                recordCategory = () => logOnlyCount++;
            }
            else
            {
                execution = new SessionExecution
                {
                    ExternalId = Guid.NewGuid(),
                    ClientId = clientId,
                    PlanId = resolved.PlanId == Guid.Empty ? null : resolved.PlanId,
                    SessionId = sessionId,
                    Date = date,
                    DateCreated = completion!.DateCreated,
                    DateUpdated = completion.DateUpdated,
                    Version = 1
                };
                ApplyCompletionFlags(execution, completion!);
                var isComplete = resolved.Session is not null && completion.IsSessionComplete(resolved.Session);
                execution.Status = isComplete ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial;
                recordCategory = () => completionOnlyCount++;
            }

            // M1 (#841): the up-front existence check (allKeys / the per-key candidate
            // query above) is a plain read — it does not lock anything. When this
            // migration is run while the service serves live traffic (the Render deploy
            // model has no maintenance window), a live write for this same
            // (clientId, sessionId, date) key can land between that check and this
            // insert (TOCTOU). The live path already created the authoritative document
            // in that race, so an E11000 here means "already handled" — count it as
            // skipped and move on rather than letting the whole migration run abort.
            if (BeforePlanBoundInsertAsync is not null)
                await BeforePlanBoundInsertAsync(clientId, sessionId, date);

            try
            {
                await _mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: ct);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex,
                    "SessionExecution migration (#841 M1): E11000 on plan-bound insert for " +
                    "client={ClientId} session={SessionId} date={Date:u} — a concurrent live " +
                    "write won the race; skipping.",
                    clientId, sessionId, date);
                skippedCount++;
                continue;
            }
            catch (MongoCommandException ex) when (ex.Code == 11000 || ex.CodeName == "DuplicateKey")
            {
                _logger.LogWarning(ex,
                    "SessionExecution migration (#841 M1): E11000 on plan-bound insert for " +
                    "client={ClientId} session={SessionId} date={Date:u} — a concurrent live " +
                    "write won the race; skipping.",
                    clientId, sessionId, date);
                skippedCount++;
                continue;
            }

            recordCategory();
        }

        // ── Ad-hoc (unplanned) WorkoutLogs — 1:1 migration, identity = ExternalId ────────
        foreach (var log in allLogs.Where(l => !l.SessionId.HasValue))
        {
            var existingFilter = Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, log.ExternalId);
            if (await _mongo.SessionExecutions.Find(existingFilter).AnyAsync(ct))
            {
                skippedCount++;
                continue;
            }

            var date = log.CompletedDate ?? WorkoutLog.ToCompletionDateUtc(log.StartedAt);
            var execution = BuildFromLog(log, log.ClientId, null, date);
            execution.Status = log.IsCompleted ? SessionExecutionStatus.Completed : SessionExecutionStatus.Partial;

            // M1 (#841): same TOCTOU guard as the plan-bound insert above — a concurrent
            // live write may have created a SessionExecution at this ExternalId between
            // the existence check and this insert.
            if (BeforeAdHocInsertAsync is not null)
                await BeforeAdHocInsertAsync(log.ExternalId);

            try
            {
                await _mongo.SessionExecutions.InsertOneAsync(execution, cancellationToken: ct);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex,
                    "SessionExecution migration (#841 M1): E11000 on ad-hoc insert for " +
                    "externalId={ExternalId} — a concurrent live write won the race; skipping.",
                    log.ExternalId);
                skippedCount++;
                continue;
            }
            catch (MongoCommandException ex) when (ex.Code == 11000 || ex.CodeName == "DuplicateKey")
            {
                _logger.LogWarning(ex,
                    "SessionExecution migration (#841 M1): E11000 on ad-hoc insert for " +
                    "externalId={ExternalId} — a concurrent live write won the race; skipping.",
                    log.ExternalId);
                skippedCount++;
                continue;
            }

            adHocCount++;
        }

        _logger.LogInformation(
            "SessionExecution migration (#841): merged={Merged} logOnly={LogOnly} completionOnly={CompletionOnly} " +
            "adHoc={AdHoc} skipped(alreadyMigrated)={Skipped}",
            mergedCount, logOnlyCount, completionOnlyCount, adHocCount, skippedCount);

        return (mergedCount, logOnlyCount, completionOnlyCount, adHocCount, skippedCount);
    }

    private static SessionExecution BuildFromLog(WorkoutLog log, Guid clientId, Guid? sessionId, DateTime date)
    {
        return new SessionExecution
        {
            ExternalId = log.ExternalId,
            ClientId = clientId,
            PlanId = log.PlanId,
            SessionId = sessionId,
            Date = date,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = log.StartedAt,
                CompletedAt = log.CompletedAt,
                Mood = log.Mood,
                Notes = log.Notes,
                WodResult = log.WodResult,
                Workouts = log.Workouts
            },
            DateCreated = log.DateCreated,
            DateUpdated = log.DateUpdated,
            Version = 1
        };
    }

    private static void ApplyCompletionFlags(SessionExecution execution, TrainingCompletion completion)
    {
        execution.CompletedExerciseIds = completion.CompletedExerciseIds;
        execution.CompletedExerciseIdsBySection = completion.CompletedExerciseIdsBySection;
        execution.CompletedWorkoutIds = completion.CompletedWorkoutIds;
        execution.CompletedSets = completion.CompletedSets;
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
    /// "Hlavní" workout wrapping the flat exercises when <c>workouts</c> is empty, then <c>$unset</c>s
    /// the legacy field. A session that already has <c>workouts</c> populated (with a stale
    /// <c>exercises</c> field left over from an earlier partial write) only has the legacy field
    /// stripped — its modern <c>workouts</c> data is left untouched.
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
                    // #857: the typed TrainingSession/TrainingWorkout classes now bind
                    // "workouts"/"workoutId" (renamed from "sections"/"sectionId") — this
                    // backfill must write into the CURRENT field names, or a legacy document
                    // migrated here would carry a stale "sections" field the typed model no
                    // longer maps, silently deserializing with an empty Workouts list.
                    var workoutsIsEmpty = !session.TryGetValue("workouts", out var workoutsValue)
                                          || workoutsValue is not BsonArray existingWorkouts
                                          || existingWorkouts.Count == 0;

                    if (workoutsIsEmpty && legacyExercises.Count > 0)
                    {
                        var synthesizedWorkout = new BsonDocument
                        {
                            { "workoutId", new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard) },
                            { "order", 0 },
                            { "name", "Hlavní" },
                            { "exercises", legacyExercises }
                        };
                        session["workouts"] = new BsonArray { synthesizedWorkout };
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
                "TrainingPlan workouts backfill: migrated {SessionCount} legacy session(s) across " +
                "{PlanCount} plan(s) to the workouts shape",
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
