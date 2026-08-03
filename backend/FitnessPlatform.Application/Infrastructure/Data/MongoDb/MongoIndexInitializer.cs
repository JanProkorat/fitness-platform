using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Creates MongoDB indexes and runs one-time, idempotent data-migration backfills
/// at application startup.
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
    /// Creates all required MongoDB indexes and runs the one-time, idempotent
    /// data-migration backfills. Must be awaited to completion before the app serves
    /// any request — see the class-level remarks and the explicit call site in
    /// <c>Program.cs</c>.
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
        // collection — the first typed read (the SessionExecution dedup pass, called from
        // CreateSessionExecutionIndexes) would throw a BSON deserialization error. This
        // migration is a no-op on a fresh database and a no-op on any database that has
        // already run it once (idempotent $exists guard).
        await MigrateCompletedWorkoutIdsRenameAsync(cancellationToken);

        // #857 step 6: MUST also run before every Create*Indexes call below. Neither
        // WorkoutLog nor SessionExecution carries [BsonIgnoreExtraElements], so once the
        // renamed BsonElement("workouts")/BsonElement("workoutId") are live on the C# types,
        // a legacy on-disk document that still carries the old "sections"/"sectionId" element
        // names is an unmapped extra element for the typed collection — the first typed read
        // (the SessionExecution dedup pass, called from CreateSessionExecutionIndexes) would
        // throw a BSON deserialization error. This migration is a no-op on a fresh database
        // and a no-op on any database that has already run it once (idempotent $exists guard).
        await MigrateWorkoutSectionsToWorkoutsRenameAsync(cancellationToken);

        // #857 phase 2: MUST also run before every Create*Indexes call below (specifically
        // CreateTrainingPlanIndexes, and the typed p.Weeks.Sessions read in
        // MigrateSessionExecutionsAsync, which is invoked separately but reads the same
        // collection). Neither TrainingWeek nor TrainingSession carries
        // [BsonIgnoreExtraElements], so once the new BsonElement("days") is live on the C#
        // type, a legacy on-disk document that still carries the old flat "sessions"/
        // "dayNotes" shape is an unmapped/missing-element mismatch for the typed collection.
        // This migration is a no-op on a fresh database and a no-op on any database that has
        // already run it once (idempotent $exists guard on the legacy "weeks.sessions" shape).
        await MigrateTrainingTreeRestructureAsync(cancellationToken);

        // #857 phase 2b: MUST run after MigrateTrainingTreeRestructureAsync above (so every
        // session already lives under weeks[].days[].sessions[] — the shape this migration's
        // BSON traversal targets) and before every Create*Indexes call below and before
        // MigrateSessionExerciseIdBackfillAsync (which only walks session["exercises"] and
        // session["workouts"] — a session still holding the legacy "sections" key would have
        // its nested exercises silently skipped by that backfill). Neither TrainingSession nor
        // TrainingWorkout carries [BsonIgnoreExtraElements], so once the renamed
        // BsonElement("workouts") is live on the C# type, a legacy session that still carries
        // the old "sections"/"sectionId" element names is an unmapped extra element for the
        // typed collection — the first typed read of TrainingPlan (BuildClientSessionLookupAsync,
        // called from MigrateCompletionExerciseInstanceIdsAsync just below) would throw a BSON
        // deserialization error, and CreateTrainingPlanIndexes would throw the same way. This
        // migration is a no-op on a fresh database and a no-op on any database that has already
        // run it once (idempotent $exists guard on the legacy "sections" shape).
        await MigrateTrainingSessionSectionsToWorkoutsAsync(cancellationToken);

        // #857 phase 3a: backfill SessionExercise.ExerciseId (a new Guid field, not a rename)
        // on every pre-existing exercise — nested inside workouts and any standalone ones alike.
        // Unlike the migrations above, a MISSING scalar field does not throw on typed read (it
        // simply deserializes to Guid.Empty), so this has no strict "before Create*Indexes"
        // ordering requirement — it is grouped here with the other #857 migrations purely for
        // readability. See the method's own remarks for the idempotency and distinctness
        // guarantees.
        await MigrateSessionExerciseIdBackfillAsync(cancellationToken);

        // #857 phase 3b: resolve completedExerciseIdsBySection (workoutId -> [externalId]) into
        // completedExerciseInstanceIds (flat [ExerciseId]) on sessionExecutions and
        // trainingCompletions. MUST run after MigrateSessionExerciseIdBackfillAsync above (needs
        // every SessionExercise.ExerciseId already assigned) and before every Create*Indexes call
        // below, for the same BsonSerializationException reason as the migrations above.
        await MigrateCompletionExerciseInstanceIdsAsync(cancellationToken);

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

        // Step 1b: renameCollection is metadata-only — it never rewrites document contents.
        // The pre-857 physical "workoutTemplates" documents (the misnamed WorkoutTemplate type,
        // a whole session skeleton) carried [BsonElement("sections")] with nested "sectionId";
        // the current SessionTemplate type they now live under maps [BsonElement("workouts")].
        // Without this rewrite, an unmigrated document is an unmapped extra element on the first
        // typed SessionTemplate read (e.g. ListWorkoutTemplatesEndpoint) and throws
        // BsonSerializationException. Must run before any typed read of the collection — same
        // ordering requirement as every other #857 boot migration.
        //
        // The OTHER half of the swap (step 2 below, sectionTemplates -> workoutTemplates) needs
        // NO equivalent rewrite: the pre-857 SectionTemplate type's field names (externalId,
        // ownerTrainerId, name, notes, defaultFormat, defaultFormatConfig, defaultExercises,
        // createdAt, updatedAt, version) are IDENTICAL to the current WorkoutTemplate type — a
        // pure collection-identity swap with no BSON shape change.
        await MigrateSessionTemplateSectionsToWorkoutsAsync(ct);

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
    /// Rewrites the top-level <c>sections</c> array on every physical <c>sessionTemplates</c>
    /// document that still carries it (i.e. the pre-857 <c>workoutTemplates</c> documents just
    /// swapped in by step 1): renames the container to <c>workouts</c> and renames
    /// <c>sectionId</c> to <c>workoutId</c> within every element, reusing
    /// <see cref="RenameSectionIdWithinEachElement"/>. See the remarks above
    /// <see cref="MigrateWorkoutTemplateCollectionSwapAsync"/> for why a collection rename alone
    /// is not enough and why this must run before any typed read of the collection.
    /// </summary>
    private async Task MigrateSessionTemplateSectionsToWorkoutsAsync(CancellationToken ct)
    {
        var rawTemplates = _mongo.SessionTemplates.Database.GetCollection<BsonDocument>(
            _mongo.SessionTemplates.CollectionNamespace.CollectionName);

        var legacyFilter = new BsonDocument("sections", new BsonDocument("$exists", true));

        using var cursor = await rawTemplates.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var migratedCount = 0;

        foreach (var templateDoc in candidates)
        {
            if (!templateDoc.TryGetValue("sections", out var sectionsValue) || sectionsValue is not BsonArray sections)
            {
                continue;
            }

            RenameSectionIdWithinEachElement(sections);

            templateDoc["workouts"] = sections;
            templateDoc.Remove("sections");

            await rawTemplates.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", templateDoc["_id"]),
                templateDoc,
                cancellationToken: ct);

            migratedCount++;
        }

        if (migratedCount > 0)
        {
            _logger.LogInformation(
                "SessionTemplate field rename: renamed sections -> workouts (and nested sectionId -> " +
                "workoutId) on {Count} document(s)",
                migratedCount);
        }
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
    // document as a raw BsonDocument, rewrites every array element in place (removing
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

    // ── #857 phase 2: materialise TrainingDay under each TrainingWeek ────────────────
    //
    // Today's on-disk shape (pre-migration): TrainingWeek carries a flat "sessions" array
    // where each session embeds its own "dayOfWeek" (int, 1=Monday..7=Sunday), plus a
    // separate "dayNotes" field — a Dictionary<int,string> stored via
    // BsonDictionaryOptions(ArrayOfDocuments), i.e. an array of {"k": <int>, "v": <string>}
    // documents, NOT a plain sub-document keyed by day number.
    //
    // Target shape: TrainingWeek carries a "days" array of exactly 7 TrainingDay documents
    // (dayOfWeek 1..7, always materialised — a rest day is a day with an empty "sessions"
    // array), each owning its own "sessions" (session's own "dayOfWeek" is dropped — the
    // parent day owns it now) and an optional "note" (folded in from the old dayNotes entry
    // for that day).
    //
    // This is a document restructure, not a field rename — $rename cannot express
    // "regroup array elements by a nested key into a new parent array", so this operates on
    // the raw BsonDocument, groups sessions by dayOfWeek, and writes the whole document back.
    //
    // MUST run before ANY typed read of TrainingPlan (see the call site in StartAsync) —
    // same BsonSerializationException risk as the other #857 boot migrations above.
    //
    // Idempotency: the candidate filter matches only documents where at least one week still
    // carries the OLD "sessions" field. On a fresh database, or a database that already ran
    // this migration, the filter matches zero documents and the loop body never runs.
    /// <summary>
    /// One-time, idempotent migration (#857 phase 2): restructures every <c>trainingPlans</c>
    /// document's <c>weeks[].sessions[]</c> (flat, each session carrying its own
    /// <c>dayOfWeek</c>) plus <c>weeks[].dayNotes</c> into <c>weeks[].days[]</c> — 7
    /// materialised <see cref="TrainingDay"/> documents per week, each owning its own
    /// <c>sessions</c> (with <c>dayOfWeek</c> dropped from the session) and an optional
    /// <c>note</c>. See the remarks above this method and the call site in
    /// <see cref="StartAsync"/> for why this must run before any typed read of the collection.
    /// </summary>
    private async Task MigrateTrainingTreeRestructureAsync(CancellationToken ct)
    {
        var rawPlans = _mongo.TrainingPlans.Database.GetCollection<BsonDocument>(
            _mongo.TrainingPlans.CollectionNamespace.CollectionName);

        var legacyFilter = new BsonDocument("weeks.sessions", new BsonDocument("$exists", true));

        using var cursor = await rawPlans.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var writes = new List<WriteModel<BsonDocument>>();
        var migratedWeekCount = 0;

        foreach (var planDoc in candidates)
        {
            if (!planDoc.TryGetValue("weeks", out var weeksValue) || weeksValue is not BsonArray weeks)
            {
                continue;
            }

            var planChanged = false;

            foreach (var weekValue in weeks)
            {
                if (weekValue is not BsonDocument week)
                {
                    continue;
                }

                if (RestructureWeekToDays(week))
                {
                    planChanged = true;
                    migratedWeekCount++;
                }
            }

            if (planChanged)
            {
                writes.Add(new ReplaceOneModel<BsonDocument>(
                    Builders<BsonDocument>.Filter.Eq("_id", planDoc["_id"]),
                    planDoc));
            }
        }

        if (writes.Count > 0)
        {
            await rawPlans.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);

            _logger.LogInformation(
                "Training tree restructure (#857): migrated {WeekCount} week(s) across " +
                "{PlanCount} training plan document(s) to the day-level TrainingDay model",
                migratedWeekCount, writes.Count);
        }
    }

    /// <summary>
    /// Restructures a single week's BSON in place: groups <c>sessions</c> by the session's
    /// (soon-to-be-dropped) <c>dayOfWeek</c> into 7 materialised day documents, folds
    /// <c>dayNotes</c> onto the matching day's <c>note</c>, and removes the old <c>sessions</c>/
    /// <c>dayNotes</c> fields. Returns <c>false</c> without modifying <paramref name="week"/> if
    /// the week has already been migrated (no <c>sessions</c> field present).
    /// </summary>
    private bool RestructureWeekToDays(BsonDocument week)
    {
        if (!week.TryGetValue("sessions", out var sessionsValue) || sessionsValue is not BsonArray sessions)
        {
            return false;
        }

        var notesByDay = ExtractLegacyDayNotes(week);
        var sessionsByDay = new Dictionary<int, BsonArray>();

        foreach (var sessionValue in sessions)
        {
            if (sessionValue is not BsonDocument session)
            {
                continue;
            }

            var dayOfWeek = session.TryGetValue("dayOfWeek", out var dayOfWeekValue) ? dayOfWeekValue.ToInt32() : 0;
            session.Remove("dayOfWeek");

            if (dayOfWeek is < 1 or > 7)
            {
                _logger.LogWarning(
                    "Training tree restructure (#857): session {SessionId} has an invalid " +
                    "dayOfWeek ({DayOfWeek}) and was dropped during migration",
                    session.TryGetValue("sessionId", out var sessionId) ? sessionId : BsonNull.Value,
                    dayOfWeek);
                continue;
            }

            if (!sessionsByDay.TryGetValue(dayOfWeek, out var daySessions))
            {
                daySessions = new BsonArray();
                sessionsByDay[dayOfWeek] = daySessions;
            }

            daySessions.Add(session);
        }

        var days = new BsonArray();

        for (var dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++)
        {
            var dayDoc = new BsonDocument
            {
                { "dayOfWeek", dayOfWeek },
                { "sessions", sessionsByDay.TryGetValue(dayOfWeek, out var daySessions) ? daySessions : new BsonArray() }
            };

            if (notesByDay.TryGetValue(dayOfWeek, out var note))
            {
                dayDoc["note"] = note;
            }

            days.Add(dayDoc);
        }

        week["days"] = days;
        week.Remove("sessions");
        week.Remove("dayNotes");

        return true;
    }

    /// <summary>
    /// Reads the legacy <c>dayNotes</c> field off a week's raw BSON — stored as
    /// <c>BsonDictionaryOptions(ArrayOfDocuments)</c>, i.e. an array of
    /// <c>{"k": &lt;int&gt;, "v": &lt;string&gt;}</c> documents, not a plain sub-document keyed
    /// by day number. Returns an empty dictionary if the field is absent or malformed.
    /// </summary>
    private static Dictionary<int, string> ExtractLegacyDayNotes(BsonDocument week)
    {
        var notesByDay = new Dictionary<int, string>();

        if (!week.TryGetValue("dayNotes", out var dayNotesValue) || dayNotesValue is not BsonArray dayNotesArray)
        {
            return notesByDay;
        }

        foreach (var entryValue in dayNotesArray)
        {
            if (entryValue is not BsonDocument entry)
            {
                continue;
            }

            if (!entry.TryGetValue("k", out var keyValue) || !entry.TryGetValue("v", out var valueValue))
            {
                continue;
            }

            notesByDay[keyValue.ToInt32()] = valueValue.AsString;
        }

        return notesByDay;
    }

    // ── #857 phase 2b: sections/sectionId -> workouts/workoutId within TrainingPlan sessions ──
    //
    // Vocabulary rename (section -> workout), same as #857 step 6 (WorkoutLog and
    // SessionExecutionPerformance) — but that migration never touched trainingPlans.
    // TrainingSession.Workouts (BSON "workouts") replaces the legacy TrainingSession.Sections
    // (BSON "sections"), and the embedded workout's SectionId is renamed to WorkoutId (BSON
    // "sectionId" -> "workoutId"). Reuses RenameSectionIdWithinEachElement — the same nested
    // element rewrite the step-6 migration uses, since $rename cannot reach into array elements.
    //
    // Target shape at the point this runs: every session already lives under
    // weeks[].days[].sessions[] (MigrateTrainingTreeRestructureAsync above has already moved
    // it there — see the call site in StartAsync). The flat weeks[].sessions[] path is also
    // checked defensively in case a document somehow reaches this method without having been
    // restructured first; it is expected to always be empty given the StartAsync ordering.
    //
    // MUST run before ANY typed read of TrainingPlan (see the call site in StartAsync) — same
    // BsonSerializationException risk as the other #857 boot migrations above.
    //
    // Idempotency: the candidate filter matches only documents where at least one session (at
    // either the days-nested or the flat path) still carries the OLD "sections" field. On a
    // fresh database, or a database that already ran this migration, the filter matches zero
    // documents and the loop body never runs.
    /// <summary>
    /// One-time, idempotent migration (#857 phase 2b): renames every <c>trainingPlans</c>
    /// session's <c>sections</c> BSON array to <c>workouts</c>, and renames <c>sectionId</c> to
    /// <c>workoutId</c> within every element. See the remarks above this method and the call
    /// site in <see cref="StartAsync"/> for why this must run after
    /// <see cref="MigrateTrainingTreeRestructureAsync"/> and before any typed read of the
    /// collection.
    /// </summary>
    private async Task MigrateTrainingSessionSectionsToWorkoutsAsync(CancellationToken ct)
    {
        var rawPlans = _mongo.TrainingPlans.Database.GetCollection<BsonDocument>(
            _mongo.TrainingPlans.CollectionNamespace.CollectionName);

        var legacyFilter = Builders<BsonDocument>.Filter.Or(
            new BsonDocument("weeks.days.sessions.sections", new BsonDocument("$exists", true)),
            new BsonDocument("weeks.sessions.sections", new BsonDocument("$exists", true)));

        using var cursor = await rawPlans.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var writes = new List<WriteModel<BsonDocument>>();
        var migratedSessionCount = 0;

        foreach (var planDoc in candidates)
        {
            if (!planDoc.TryGetValue("weeks", out var weeksValue) || weeksValue is not BsonArray weeks)
            {
                continue;
            }

            var planChanged = false;

            foreach (var weekValue in weeks)
            {
                if (weekValue is not BsonDocument week)
                {
                    continue;
                }

                var weekRenamedCount = RenameSessionSectionsWithinWeek(week);
                if (weekRenamedCount > 0)
                {
                    migratedSessionCount += weekRenamedCount;
                    planChanged = true;
                }
            }

            if (planChanged)
            {
                writes.Add(new ReplaceOneModel<BsonDocument>(
                    Builders<BsonDocument>.Filter.Eq("_id", planDoc["_id"]),
                    planDoc));
            }
        }

        if (writes.Count > 0)
        {
            await rawPlans.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);

            _logger.LogInformation(
                "TrainingSession field rename (#857 phase 2b): renamed sections -> workouts " +
                "(and nested sectionId -> workoutId) on {Count} session(s) across " +
                "{PlanCount} training plan document(s)",
                migratedSessionCount, writes.Count);
        }
    }

    /// <summary>
    /// Renames <c>sections</c> to <c>workouts</c> (and nested <c>sectionId</c> to
    /// <c>workoutId</c>) on every session found within <paramref name="week"/> — both the
    /// days-nested path (<c>days[].sessions[]</c>, the expected shape at this point in
    /// <see cref="StartAsync"/>) and the flat path (<c>sessions[]</c>, checked defensively —
    /// see the remarks above <see cref="MigrateTrainingSessionSectionsToWorkoutsAsync"/>).
    /// Returns the number of sessions actually renamed.
    /// </summary>
    private static int RenameSessionSectionsWithinWeek(BsonDocument week)
    {
        var renamedCount = 0;

        if (week.TryGetValue("days", out var daysValue) && daysValue is BsonArray days)
        {
            foreach (var dayValue in days)
            {
                if (dayValue is BsonDocument day)
                {
                    renamedCount += RenameSessionSectionsWithinArray(day);
                }
            }
        }

        renamedCount += RenameSessionSectionsWithinArray(week);

        return renamedCount;
    }

    /// <summary>
    /// Renames <c>sections</c> to <c>workouts</c> (and nested <c>sectionId</c> to
    /// <c>workoutId</c>) on every session within <paramref name="parent"/>'s <c>sessions</c>
    /// array. Sessions with no <c>sections</c> field (already migrated, or genuinely never had
    /// any workouts) are left untouched. Returns the number of sessions renamed.
    /// </summary>
    private static int RenameSessionSectionsWithinArray(BsonDocument parent)
    {
        if (!parent.TryGetValue("sessions", out var sessionsValue) || sessionsValue is not BsonArray sessions)
        {
            return 0;
        }

        var renamedCount = 0;

        foreach (var sessionValue in sessions)
        {
            if (sessionValue is not BsonDocument session)
            {
                continue;
            }

            if (!session.TryGetValue("sections", out var sectionsFieldValue) || sectionsFieldValue is not BsonArray sectionsArray)
            {
                continue;
            }

            RenameSectionIdWithinEachElement(sectionsArray);

            session["workouts"] = sectionsArray;
            session.Remove("sections");
            renamedCount++;
        }

        return renamedCount;
    }

    // ── #857 phase 3a: backfill SessionExercise.ExerciseId ───────────────────────────
    //
    // SessionExercise gains a new instance-identity field, ExerciseId — a Guid distinguishing
    // two occurrences of the same catalog exercise (ExerciseExternalId) programmed twice in one
    // workout, or once standalone and once nested. This is an ADDITIVE field, not a rename:
    // $rename cannot mint a fresh, per-instance value, so this walks the raw BSON tree (weeks ->
    // days -> sessions -> {workouts -> exercises, exercises}) and assigns a distinct new Guid to
    // every exercise element that doesn't already carry one.
    //
    // Idempotency: unlike the migrations above, there is no single shallow field whose presence/
    // absence reliably signals "every exercise in this document already has exerciseId" — the
    // field lives 4-5 array levels deep (weeks -> days -> sessions -> workouts -> exercises, and
    // weeks -> days -> sessions -> exercises), and a query filter that gets that traversal subtly
    // wrong would silently skip documents rather than error. So this scans every trainingPlans
    // document unconditionally and relies on the per-exercise "skip if exerciseId already present"
    // check (AssignExerciseIdsWithinArray) for both correctness and idempotency: a document where
    // every exercise already carries exerciseId is walked but produces 0 assignments, so it is
    // never added to the BulkWrite batch — a true no-op on every boot after the first.
    //
    // Distinctness: each exercise element gets its OWN fresh Guid.NewGuid() call — never a value
    // derived from ExerciseExternalId or any other shared key — so two instances of the same
    // catalog exercise in one session always end up with distinct ExerciseId values. This is the
    // entire point of the field; a migration that assigned one id per catalog exercise instead of
    // per instance would look correct and silently defeat the feature.
    /// <summary>
    /// One-time, idempotent migration (#857 phase 3a): assigns a fresh, distinct
    /// <see cref="SessionExercise.ExerciseId"/> to every exercise in every <c>trainingPlans</c>
    /// document that doesn't already carry one — both exercises nested inside a workout and any
    /// standalone exercises directly on a session. See the remarks above this method for the
    /// idempotency and distinctness guarantees.
    /// </summary>
    private async Task MigrateSessionExerciseIdBackfillAsync(CancellationToken ct)
    {
        var rawPlans = _mongo.TrainingPlans.Database.GetCollection<BsonDocument>(
            _mongo.TrainingPlans.CollectionNamespace.CollectionName);

        using var cursor = await rawPlans.FindAsync(FilterDefinition<BsonDocument>.Empty, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        var writes = new List<WriteModel<BsonDocument>>();
        var assignedCount = 0;

        foreach (var planDoc in candidates)
        {
            var planChanged = false;

            if (!planDoc.TryGetValue("weeks", out var weeksValue) || weeksValue is not BsonArray weeks)
            {
                continue;
            }

            foreach (var weekValue in weeks)
            {
                if (weekValue is not BsonDocument week
                    || !week.TryGetValue("days", out var daysValue)
                    || daysValue is not BsonArray days)
                {
                    continue;
                }

                foreach (var dayValue in days)
                {
                    if (dayValue is not BsonDocument day
                        || !day.TryGetValue("sessions", out var sessionsValue)
                        || sessionsValue is not BsonArray sessions)
                    {
                        continue;
                    }

                    foreach (var sessionValue in sessions)
                    {
                        if (sessionValue is not BsonDocument session)
                        {
                            continue;
                        }

                        var sessionAssignedCount = AssignExerciseIdsWithinSession(session);
                        if (sessionAssignedCount > 0)
                        {
                            planChanged = true;
                            assignedCount += sessionAssignedCount;
                        }
                    }
                }
            }

            if (planChanged)
            {
                writes.Add(new ReplaceOneModel<BsonDocument>(
                    Builders<BsonDocument>.Filter.Eq("_id", planDoc["_id"]),
                    planDoc));
            }
        }

        if (writes.Count > 0)
        {
            await rawPlans.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);

            _logger.LogInformation(
                "SessionExercise ExerciseId backfill (#857 phase 3a): assigned {ExerciseCount} " +
                "exerciseId value(s) across {PlanCount} training plan document(s)",
                assignedCount, writes.Count);
        }
    }

    /// <summary>
    /// Assigns a fresh <c>exerciseId</c> to every exercise element within a single session's raw
    /// BSON — both its standalone <c>exercises</c> array and every workout's nested <c>exercises</c>
    /// array. Returns the number of exercise elements assigned (0 means the session was already
    /// fully migrated and is left untouched).
    /// </summary>
    private static int AssignExerciseIdsWithinSession(BsonDocument session)
    {
        var assignedCount = 0;

        if (session.TryGetValue("exercises", out var standaloneValue) && standaloneValue is BsonArray standaloneExercises)
        {
            assignedCount += AssignExerciseIdsWithinArray(standaloneExercises);
        }

        if (session.TryGetValue("workouts", out var workoutsValue) && workoutsValue is BsonArray workouts)
        {
            foreach (var workoutValue in workouts)
            {
                if (workoutValue is not BsonDocument workout)
                {
                    continue;
                }

                if (workout.TryGetValue("exercises", out var exercisesValue) && exercisesValue is BsonArray exercises)
                {
                    assignedCount += AssignExerciseIdsWithinArray(exercises);
                }
            }
        }

        return assignedCount;
    }

    /// <summary>
    /// Assigns a fresh, distinct <c>exerciseId</c> (Guid, Standard representation) to every
    /// element of <paramref name="exercises"/> that doesn't already carry one. Elements already
    /// carrying an <c>exerciseId</c> are left untouched — this is what makes a second boot a
    /// no-op.
    /// </summary>
    private static int AssignExerciseIdsWithinArray(BsonArray exercises)
    {
        var assignedCount = 0;

        foreach (var exerciseValue in exercises)
        {
            if (exerciseValue is not BsonDocument exercise)
            {
                continue;
            }

            if (exercise.Contains("exerciseId"))
            {
                continue;
            }

            exercise["exerciseId"] = new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard);
            assignedCount++;
        }

        return assignedCount;
    }

    // ── #857 phase 3b: resolve completedExerciseIdsBySection into completedExerciseInstanceIds ──
    //
    // completedExerciseIdsBySection (keyed by TrainingWorkout.WorkoutId, valued with catalog
    // SessionExercise.ExerciseExternalId values) cannot distinguish two occurrences of the same
    // catalog exercise within one workout, or between a standalone occurrence and a nested one —
    // exactly the ambiguity SessionExercise.ExerciseId (#857 phase 3a) exists to remove. This
    // migration resolves every (workoutId, externalId) pair against the exercise's OWN plan
    // session — found via the workoutId key, never the flat session-wide exercise view, so a
    // duplicate catalog exercise appearing both standalone and nested in a workout of the same
    // session resolves to the correct (workout-scoped) instance rather than an arbitrary one —
    // to the corresponding SessionExercise.ExerciseId, writes the flat
    // completedExerciseInstanceIds list, rekeys completedSets from ExerciseExternalId to
    // ExerciseId, and drops the two retired fields (completedExerciseIds,
    // completedExerciseIdsBySection) from both sessionExecutions and trainingCompletions
    // documents.
    //
    // Unlike every other #857 migration, a resolution failure here does NOT throw — an entry
    // that cannot be resolved (its session, workout, or exercise no longer exists in the plan)
    // is silently indistinguishable from "never completed" once dropped, which is precisely the
    // failure mode this slice exists to eliminate. So this counts every unresolved entry and logs
    // a single summary warning; the migration test asserts that count is zero for seeded data.
    //
    // MUST run before ANY typed read of either collection (see the call site in StartAsync) —
    // same BsonSerializationException risk as the other #857 boot migrations: once the C# type
    // drops CompletedExerciseIds/CompletedExerciseIdsBySection, an unmigrated legacy document
    // still carrying those elements is an unmapped extra element on the next typed read. Must
    // also run AFTER MigrateSessionExerciseIdBackfillAsync, since resolution depends on every
    // SessionExercise already carrying its ExerciseId.
    //
    // Idempotency: the candidate filter matches any document that still carries EITHER retired
    // element — "completedExerciseIdsBySection" (the by-workout dictionary) OR
    // "completedExerciseIds" (the older, flat list that predates the dictionary and can appear
    // alone). On a fresh database, or a database that already ran this migration, the filter
    // matches zero documents and the loop body never runs.
    //
    // Flat-only documents (completedExerciseIds present, completedExerciseIdsBySection absent):
    // this shape predates the by-workout dictionary, so it carries no workoutId attribution at
    // all — unlike the bySection path, there is no named workout to resolve strictly within. The
    // best available correlation is the session's flat exercise view
    // (TrainingSession.Exercises — standalone + every workout's nested exercises), which is
    // exactly the ambiguity SessionExercise.ExerciseId (#857 phase 3a) exists to remove: if a
    // catalog ExerciseExternalId appears in more than one place in the session (nested twice,
    // or once standalone and once nested), resolving against the flat view cannot tell which one
    // was actually completed. So a flat-field id resolves ONLY when it matches exactly one
    // SessionExercise across the whole session; any other id count (zero — exercise no longer
    // in the plan; two-or-more — genuinely ambiguous) is counted unresolved rather than guessed.
    /// <summary>
    /// One-time, idempotent migration (#857 phase 3b): resolves the retired
    /// <c>completedExerciseIdsBySection</c> dictionary (and the older, dictionary-less flat
    /// <c>completedExerciseIds</c> list it predates) on every <c>sessionExecutions</c> and
    /// <c>trainingCompletions</c> document into the flat <c>completedExerciseInstanceIds</c> list,
    /// rekeys <c>completedSets</c> from <see cref="SessionExercise.ExerciseExternalId"/> to
    /// <see cref="SessionExercise.ExerciseId"/>, and drops the two retired fields. See the remarks
    /// above this method and the call site in <see cref="StartAsync"/> for why this must run
    /// before any typed read of either collection.
    /// </summary>
    /// <returns>
    /// The total number of individual (workoutId, exerciseExternalId) completion entries across
    /// both collections that could not be resolved to a <see cref="SessionExercise"/> instance
    /// (session, workout, or exercise no longer present in the plan) and were dropped. Internal
    /// (not private) so Testcontainers migration tests can assert this is zero for seeded data —
    /// see <c>InternalsVisibleTo("FitnessPlatform.Tests")</c> elsewhere in this assembly.
    /// </returns>
    internal async Task<int> MigrateCompletionExerciseInstanceIdsAsync(CancellationToken ct)
    {
        var sessionCacheByClient = new Dictionary<Guid, Dictionary<Guid, TrainingSession>>();

        var executionsUnresolved = await ResolveCompletionExerciseInstancesAsync(
            _mongo.SessionExecutions.Database.GetCollection<BsonDocument>(
                _mongo.SessionExecutions.CollectionNamespace.CollectionName),
            "SessionExecution", sessionCacheByClient, ct);

        var completionsUnresolved = await ResolveCompletionExerciseInstancesAsync(
            _mongo.TrainingCompletions.Database.GetCollection<BsonDocument>(
                _mongo.TrainingCompletions.CollectionNamespace.CollectionName),
            "TrainingCompletion", sessionCacheByClient, ct);

        var totalUnresolved = executionsUnresolved + completionsUnresolved;
        if (totalUnresolved > 0)
        {
            _logger.LogWarning(
                "Completion exercise-instance resolution (#857 phase 3b): {Count} completion " +
                "entry/entries could not be resolved to a SessionExercise instance (session, " +
                "workout, or exercise no longer exists in the plan) and were dropped.",
                totalUnresolved);
        }

        return totalUnresolved;
    }

    /// <summary>
    /// Resolves the legacy <c>completedExerciseIdsBySection</c> shape — and the older,
    /// dictionary-less flat <c>completedExerciseIds</c> shape it predates — on every candidate
    /// document in <paramref name="rawCollection"/>. See the remarks above
    /// <see cref="MigrateCompletionExerciseInstanceIdsAsync"/> for the full algorithm, including
    /// why a flat-only document can only resolve unambiguous ids. Returns the number of
    /// individual exercise-completion entries that could not be resolved.
    /// </summary>
    private async Task<int> ResolveCompletionExerciseInstancesAsync(
        IMongoCollection<BsonDocument> rawCollection,
        string collectionLabel,
        Dictionary<Guid, Dictionary<Guid, TrainingSession>> sessionCacheByClient,
        CancellationToken ct)
    {
        var legacyFilter = Builders<BsonDocument>.Filter.Or(
            Builders<BsonDocument>.Filter.Exists("completedExerciseIdsBySection"),
            Builders<BsonDocument>.Filter.Exists("completedExerciseIds"));

        using var cursor = await rawCollection.FindAsync(legacyFilter, cancellationToken: ct);
        var candidates = await cursor.ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return 0;
        }

        var writes = new List<WriteModel<BsonDocument>>();
        var unresolvedCount = 0;
        var migratedCount = 0;

        foreach (var doc in candidates)
        {
            var clientId = doc["clientId"].AsGuid;
            var bySection = doc.TryGetValue("completedExerciseIdsBySection", out var bySectionValue)
                && bySectionValue is BsonDocument bySectionDoc
                    ? bySectionDoc
                    : null;

            // No sessionId (ad-hoc/unplanned doc) — there is no plan session to resolve
            // against, so every entry in this document is unresolved.
            if (!doc.TryGetValue("sessionId", out var sessionIdValue) || sessionIdValue.IsBsonNull)
            {
                unresolvedCount += CountLegacyCompletionEntries(doc, bySection);
                doc["completedExerciseInstanceIds"] = new BsonArray();
                doc.Remove("completedExerciseIdsBySection");
                doc.Remove("completedExerciseIds");
                writes.Add(new ReplaceOneModel<BsonDocument>(Builders<BsonDocument>.Filter.Eq("_id", doc["_id"]), doc));
                migratedCount++;
                continue;
            }

            var sessionId = sessionIdValue.AsGuid;

            if (!sessionCacheByClient.TryGetValue(clientId, out var sessionLookup))
            {
                sessionLookup = await BuildClientSessionLookupAsync(clientId, ct);
                sessionCacheByClient[clientId] = sessionLookup;
            }

            sessionLookup.TryGetValue(sessionId, out var session);

            var completedSets = doc.TryGetValue("completedSets", out var completedSetsValue)
                && completedSetsValue is BsonDocument completedSetsDoc
                    ? completedSetsDoc
                    : null;

            var instanceIds = new BsonArray();
            var newCompletedSets = new BsonDocument();

            // A document can carry BOTH shapes at once — the now-retired SessionExecutionBackfill
            // explicitly attributed flat ids that were absent from the dictionary, so a pre-857
            // document can have a populated completedExerciseIdsBySection AND a flat
            // completedExerciseIds list holding ids the dictionary never accounted for. Track every
            // externalId already resolved via the dictionary so the flat pass below never re-resolves
            // (or double-counts) one of them; it exists only to pick up what the dictionary missed.
            var resolvedViaBySection = new HashSet<Guid>();

            if (bySection is not null)
            {
                foreach (var element in bySection.Elements)
                {
                    var externalIds = element.Value.AsBsonArray;

                    // Resolve strictly within the NAMED workout — never the session's flat
                    // exercise view — so a catalog exercise duplicated both standalone and
                    // nested resolves to the workout-scoped instance that was actually marked
                    // complete.
                    var workout = session is not null && Guid.TryParse(element.Name, out var workoutId)
                        ? session.Workouts.FirstOrDefault(w => w.WorkoutId == workoutId)
                        : null;

                    foreach (var externalIdValue in externalIds)
                    {
                        var externalId = externalIdValue.AsGuid;
                        resolvedViaBySection.Add(externalId);
                        var exercise = workout?.Exercises.FirstOrDefault(e => e.ExerciseExternalId == externalId);

                        if (exercise is null)
                        {
                            unresolvedCount++;
                            continue;
                        }

                        instanceIds.Add(new BsonBinaryData(exercise.ExerciseId, GuidRepresentation.Standard));

                        if (completedSets is not null && completedSets.TryGetValue(externalId.ToString(), out var setNumbers))
                        {
                            newCompletedSets[exercise.ExerciseId.ToString()] = setNumbers;
                        }
                    }
                }
            }

            if (doc.TryGetValue("completedExerciseIds", out var flatValue) && flatValue is BsonArray flatExternalIds)
            {
                // Process the flat list IN ADDITION to the dictionary, never as an alternative to
                // it — a mixed-shape document must not lose a flat id the dictionary didn't already
                // account for. There is no workoutId to resolve strictly within here, so fall back
                // to the session's flat exercise view (standalone + every workout's nested
                // exercises) and resolve only when the catalog id is unambiguous across it; see the
                // remarks above MigrateCompletionExerciseInstanceIdsAsync for why an ambiguous match
                // is counted unresolved rather than guessed.
                foreach (var externalIdValue in flatExternalIds)
                {
                    var externalId = externalIdValue.AsGuid;

                    if (resolvedViaBySection.Contains(externalId))
                    {
                        continue;
                    }

                    var matches = session?.Exercises
                        .Where(e => e.ExerciseExternalId == externalId)
                        .ToList() ?? [];

                    if (matches.Count != 1)
                    {
                        unresolvedCount++;
                        continue;
                    }

                    var exercise = matches[0];
                    instanceIds.Add(new BsonBinaryData(exercise.ExerciseId, GuidRepresentation.Standard));

                    if (completedSets is not null && completedSets.TryGetValue(externalId.ToString(), out var setNumbers))
                    {
                        newCompletedSets[exercise.ExerciseId.ToString()] = setNumbers;
                    }
                }
            }

            doc["completedExerciseInstanceIds"] = instanceIds;
            doc.Remove("completedExerciseIdsBySection");
            doc.Remove("completedExerciseIds");

            if (completedSets is not null)
            {
                if (newCompletedSets.ElementCount > 0)
                {
                    doc["completedSets"] = newCompletedSets;
                }
                else
                {
                    doc.Remove("completedSets");
                }
            }

            writes.Add(new ReplaceOneModel<BsonDocument>(Builders<BsonDocument>.Filter.Eq("_id", doc["_id"]), doc));
            migratedCount++;
        }

        if (writes.Count > 0)
        {
            await rawCollection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);

            _logger.LogInformation(
                "{Collection} completion exercise-instance resolution (#857 phase 3b): migrated " +
                "{Count} document(s), {Unresolved} unresolved entry/entries",
                collectionLabel, migratedCount, unresolvedCount);
        }

        return unresolvedCount;
    }

    /// <summary>
    /// Counts the individual exercise-completion entries carried by a document that has no
    /// resolvable <c>sessionId</c> — used only for the unresolved counter, since every entry in
    /// such a document is unresolved regardless of shape.
    /// </summary>
    /// <remarks>
    /// Counts the DISTINCT catalog ids across BOTH shapes rather than preferring the by-workout
    /// dictionary. A document can carry the dictionary AND a flat <c>completedExerciseIds</c>
    /// holding ids the dictionary never attributed — the same mixed shape that made the
    /// resolution pass above drop entries silently. Reading only the dictionary here understated
    /// the unresolved total, which is the one number an operator uses to judge whether this
    /// migration lost anything; understating it defeats that check. Distinct, because an id
    /// present in both shapes is one unmigrated entry, not two.
    /// </remarks>
    private static int CountLegacyCompletionEntries(BsonDocument doc, BsonDocument? bySection)
    {
        var entries = new HashSet<Guid>();

        if (bySection is not null)
        {
            foreach (var element in bySection.Elements)
            {
                foreach (var id in element.Value.AsBsonArray)
                {
                    entries.Add(id.AsGuid);
                }
            }
        }

        if (doc.TryGetValue("completedExerciseIds", out var flatValue) && flatValue is BsonArray flatIds)
        {
            foreach (var id in flatIds)
            {
                entries.Add(id.AsGuid);
            }
        }

        return entries.Count;
    }

    /// <summary>
    /// Builds a lookup of every <see cref="TrainingSession"/> across all of a client's training
    /// plans, keyed by <see cref="TrainingSession.SessionId"/>. Prefers the most-recently-updated
    /// plan's session when a client has more than one plan sharing a SessionId. Uses the TYPED
    /// <see cref="IMongoContext.TrainingPlans"/> collection — safe at this point in
    /// <see cref="StartAsync"/> because <see cref="MigrateTrainingTreeRestructureAsync"/>,
    /// <see cref="MigrateTrainingSessionSectionsToWorkoutsAsync"/>, and
    /// <see cref="MigrateSessionExerciseIdBackfillAsync"/> have already run, so every plan
    /// document is fully in the current C# shape (days materialised, sections renamed to
    /// workouts, ExerciseId assigned).
    /// </summary>
    private async Task<Dictionary<Guid, TrainingSession>> BuildClientSessionLookupAsync(Guid clientId, CancellationToken ct)
    {
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, clientId);
        using var cursor = await _mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plans = await cursor.ToListAsync(ct);

        return plans
            .OrderByDescending(p => p.DateUpdated ?? p.DateCreated)
            .SelectMany(p => p.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Sessions))
            .GroupBy(s => s.SessionId)
            .ToDictionary(g => g.Key, g => g.First());
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
    /// (which also runs the other unrelated collection migrations) — see
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
        // prefers the most-recently-updated plan's session when a client has more than one
        // plan sharing a SessionId.
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
                .SelectMany(p => p.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Sessions).Select(s => (Plan: p, Session: s)))
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

    /// <summary>
    /// Copies the checkbox completion flags from a legacy <see cref="TrainingCompletion"/> onto a
    /// freshly-built <see cref="SessionExecution"/>. Pure field copy — by the time this runs,
    /// <see cref="MigrateCompletionExerciseInstanceIdsAsync"/> has already resolved
    /// <paramref name="completion"/>'s <c>completedExerciseIdsBySection</c> into
    /// <see cref="TrainingCompletion.CompletedExerciseInstanceIds"/> (both collections are
    /// migrated by the same boot-time step), so this needs no plan/session access of its own —
    /// re-resolving here would be a second, divergent implementation of the same resolution.
    /// </summary>
    private static void ApplyCompletionFlags(SessionExecution execution, TrainingCompletion completion)
    {
        execution.CompletedExerciseInstanceIds = completion.CompletedExerciseInstanceIds;
        execution.CompletedWorkoutIds = completion.CompletedWorkoutIds;
        execution.CompletedSets = completion.CompletedSets;
    }

}
