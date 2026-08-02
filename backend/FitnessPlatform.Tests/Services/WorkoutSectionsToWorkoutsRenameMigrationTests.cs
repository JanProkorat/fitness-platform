using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #857 step-6 boot migration in
/// <see cref="MongoIndexInitializer"/> — the private
/// <c>MigrateWorkoutSectionsToWorkoutsRenameAsync</c> method, which rewrites the
/// <c>sections</c> BSON array to <c>workouts</c> on both the <c>workoutLogs</c> collection
/// (top-level) and the <c>sessionExecutions</c> collection (nested under <c>performance</c>),
/// and renames <c>sectionId</c> to <c>workoutId</c> within every array element.
/// </summary>
/// <remarks>
/// <para>
/// The method under test is <c>private</c> — it can only be exercised through the public
/// <see cref="MongoIndexInitializer.StartAsync"/> entry point, mirroring
/// <see cref="CompletedWorkoutIdsRenameMigrationTests"/>. Each test seeds a legacy-shaped
/// document directly as a raw <see cref="BsonDocument"/> carrying the OLD <c>sections</c>/
/// <c>sectionId</c> element names (bypassing the typed <see cref="WorkoutLog"/>/
/// <see cref="SessionExecution"/>/<see cref="LoggedWorkout"/> classes entirely — those
/// classes' properties already map to the NEW <c>workouts</c>/<c>workoutId</c> elements, so
/// seeding through the typed model would write the new names and the migration would have
/// nothing to rename, proving nothing). This mirrors how real pre-#857 legacy data looks on
/// disk.
/// </para>
/// <para>
/// Uses a dedicated, per-test <see cref="MongoDbBuilder"/> container (mirroring
/// <see cref="CompletedWorkoutIdsRenameMigrationTests"/>, reusing its
/// <see cref="MigrationTestMongoContext"/>) rather than the shared suite-wide container, so
/// the exact document shapes asserted below stay independent of other test classes' fixtures
/// and of ordering within the full suite run.
/// </para>
/// </remarks>
public class WorkoutSectionsToWorkoutsRenameMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    // ── (1) WorkoutLog — nested workoutId survives on every array element ───────────

    [Fact]
    public async Task Rename_WorkoutLogLegacySections_ValuesSurviveUnderWorkoutsOnEveryElement()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("workout_sections_rename_log_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");

        var logExternalId = Guid.NewGuid();
        var workoutIdOne = Guid.NewGuid();
        var workoutIdTwo = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        // NOTE: legacy shape — top-level "sections", nested "sectionId" on TWO elements
        // (not just the first) so the nested rename is proven across the whole array.
        var legacyLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logExternalId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddHours(-1) },
            { "completedAt", DateTime.UtcNow },
            { "isCompleted", true },
            {
                "sections", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(workoutIdOne) },
                        { "order", 0 },
                        { "name", "Hlavní" },
                        {
                            "exercises", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "exerciseExternalId", GuidBson(exerciseId) },
                                    { "exerciseName", "QA Squat" },
                                    { "sets", new BsonArray() }
                                }
                            }
                        }
                    },
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(workoutIdTwo) },
                        { "order", 1 },
                        { "name", "AMRAP" },
                        { "exercises", new BsonArray() }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawLogs.InsertOneAsync(legacyLogDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.WorkoutLogs
            .Find(Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, logExternalId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.Workouts.Should().HaveCount(2);
        migrated.Workouts[0].WorkoutId.Should().Be(workoutIdOne,
            "the nested workoutId must survive on the FIRST array element");
        migrated.Workouts[1].WorkoutId.Should().Be(workoutIdTwo,
            "the nested workoutId must survive on the SECOND array element too — not just the first");

        var rawAfter = await rawLogs
            .Find(new BsonDocument("externalId", GuidBson(logExternalId)))
            .FirstOrDefaultAsync(ct);
        rawAfter.Contains("sections").Should().BeFalse(
            "the legacy container element name must be renamed away, not merely duplicated alongside the new one");
        rawAfter.Contains("workouts").Should().BeTrue();

        var rawWorkouts = rawAfter["workouts"].AsBsonArray;
        foreach (var rawWorkout in rawWorkouts)
        {
            var rawWorkoutDoc = rawWorkout.AsBsonDocument;
            rawWorkoutDoc.Contains("sectionId").Should().BeFalse(
                "the nested legacy element name must be renamed away on every array element");
            rawWorkoutDoc.Contains("workoutId").Should().BeTrue();
        }
    }

    // ── (2) SessionExecution — nested workoutId survives under performance.workouts ─

    [Fact]
    public async Task Rename_SessionExecutionLegacyPerformanceSections_ValuesSurviveUnderWorkoutsOnEveryElement()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("workout_sections_rename_execution_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");

        var executionId = Guid.NewGuid();
        var workoutIdOne = Guid.NewGuid();
        var workoutIdTwo = Guid.NewGuid();

        var legacyExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(executionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Completed" },
            { "completedExerciseIds", new BsonArray() },
            {
                "performance", new BsonDocument
                {
                    { "startedAt", DateTime.UtcNow.AddHours(-1) },
                    { "completedAt", DateTime.UtcNow },
                    {
                        // NOTE: legacy element name — the pre-#857 on-disk shape, with TWO
                        // elements so the nested rename is proven across the whole array.
                        "sections", new BsonArray
                        {
                            new BsonDocument
                            {
                                { "sectionId", GuidBson(workoutIdOne) },
                                { "order", 0 },
                                { "name", "Hlavní" },
                                { "exercises", new BsonArray() }
                            },
                            new BsonDocument
                            {
                                { "sectionId", GuidBson(workoutIdTwo) },
                                { "order", 1 },
                                { "name", "AMRAP" },
                                { "exercises", new BsonArray() }
                            }
                        }
                    }
                }
            },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawExecutions.InsertOneAsync(legacyExecutionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.Performance.Should().NotBeNull();
        migrated.Performance!.Workouts.Should().HaveCount(2);
        migrated.Performance.Workouts[0].WorkoutId.Should().Be(workoutIdOne,
            "the nested workoutId must survive on the FIRST array element");
        migrated.Performance.Workouts[1].WorkoutId.Should().Be(workoutIdTwo,
            "the nested workoutId must survive on the SECOND array element too — not just the first");

        var rawAfter = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId)))
            .FirstOrDefaultAsync(ct);
        var rawPerformance = rawAfter["performance"].AsBsonDocument;
        rawPerformance.Contains("sections").Should().BeFalse(
            "the legacy container element name must be renamed away, not merely duplicated alongside the new one");
        rawPerformance.Contains("workouts").Should().BeTrue();

        var rawWorkouts = rawPerformance["workouts"].AsBsonArray;
        foreach (var rawWorkout in rawWorkouts)
        {
            var rawWorkoutDoc = rawWorkout.AsBsonDocument;
            rawWorkoutDoc.Contains("sectionId").Should().BeFalse(
                "the nested legacy element name must be renamed away on every array element");
            rawWorkoutDoc.Contains("workoutId").Should().BeTrue();
        }
    }

    // ── (3) IDEMPOTENCY — a second boot is a clean no-op on both collections ────────

    [Fact]
    public async Task Rename_SecondBoot_IsIdempotent_NoOpOnBothCollections()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("workout_sections_rename_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");
        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");

        var logExternalId = Guid.NewGuid();
        var executionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var legacyLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logExternalId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddHours(-1) },
            { "isCompleted", false },
            {
                "sections", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(workoutId) },
                        { "order", 0 },
                        { "name", "Hlavní" },
                        { "exercises", new BsonArray() }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawLogs.InsertOneAsync(legacyLogDoc, cancellationToken: ct);

        var legacyExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(executionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Completed" },
            { "completedExerciseIds", new BsonArray() },
            {
                "performance", new BsonDocument
                {
                    { "startedAt", DateTime.UtcNow.AddHours(-1) },
                    {
                        "sections", new BsonArray
                        {
                            new BsonDocument
                            {
                                { "sectionId", GuidBson(workoutId) },
                                { "order", 0 },
                                { "name", "Hlavní" },
                                { "exercises", new BsonArray() }
                            }
                        }
                    }
                }
            },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawExecutions.InsertOneAsync(legacyExecutionDoc, cancellationToken: ct);

        // ── First boot: performs the rename on both collections ─────────────────────
        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer1.StartAsync(ct);

        var logAfterFirstBoot = await rawLogs
            .Find(new BsonDocument("externalId", GuidBson(logExternalId))).FirstOrDefaultAsync(ct);
        var executionAfterFirstBoot = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId))).FirstOrDefaultAsync(ct);

        // ── Second boot (simulating a redeploy / restart against the same database):
        // the $exists guard must find zero documents at the OLD element name and skip
        // cleanly rather than throwing or re-touching the already-migrated documents. ──
        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer2.StartAsync(ct);
        await act.Should().NotThrowAsync("re-running the migration on already-renamed data must be safe");

        var logAfterSecondBoot = await rawLogs
            .Find(new BsonDocument("externalId", GuidBson(logExternalId))).FirstOrDefaultAsync(ct);
        var executionAfterSecondBoot = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId))).FirstOrDefaultAsync(ct);

        // BsonDocument.Equals is structural — proves the second boot mutated 0 documents,
        // not just that the typed values still happen to look right.
        logAfterSecondBoot!.Equals(logAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents on workoutLogs — the already-renamed document is untouched");
        executionAfterSecondBoot!.Equals(executionAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents on sessionExecutions — the already-renamed document is untouched");

        var migratedLog = await mongo.WorkoutLogs
            .Find(Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, logExternalId))
            .FirstOrDefaultAsync(ct);
        migratedLog!.Workouts.Should().ContainSingle(w => w.WorkoutId == workoutId,
            "values must still be intact after the second boot");

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionId))
            .FirstOrDefaultAsync(ct);
        migratedExecution!.Performance!.Workouts.Should().ContainSingle(w => w.WorkoutId == workoutId,
            "values must still be intact after the second boot");
    }

    // ── (4) UNTOUCHED — documents already on the new shape are not corrupted ────────

    [Fact]
    public async Task Rename_DocumentsAlreadyOnNewShape_AreNotCorrupted()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("workout_sections_rename_untouched_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");
        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");

        // WorkoutLog already on the NEW field names (e.g. written by post-857 code).
        var alreadyNewLogExternalId = Guid.NewGuid();
        var alreadyNewWorkoutId = Guid.NewGuid();
        var alreadyNewLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(alreadyNewLogExternalId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddHours(-1) },
            { "isCompleted", false },
            {
                "workouts", new BsonArray
                {
                    new BsonDocument
                    {
                        { "workoutId", GuidBson(alreadyNewWorkoutId) },
                        { "order", 0 },
                        { "name", "Hlavní" },
                        { "exercises", new BsonArray() }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawLogs.InsertOneAsync(alreadyNewLogDoc, cancellationToken: ct);

        // SessionExecution with NO performance sub-document at all — genuinely optional
        // (a lightweight Today-card checkbox completion, never ran the live-training flow).
        var noPerformanceExecutionId = Guid.NewGuid();
        var noPerformanceExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(noPerformanceExecutionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Partial" },
            { "completedExerciseIds", new BsonArray() },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
            // NOTE: no "performance" field at all.
        };
        await rawExecutions.InsertOneAsync(noPerformanceExecutionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync(
            "neither an already-renamed document nor a performance-absent document should trip the $exists guard");

        var migratedLog = await mongo.WorkoutLogs
            .Find(Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, alreadyNewLogExternalId))
            .FirstOrDefaultAsync(ct);
        migratedLog.Should().NotBeNull();
        migratedLog!.Workouts.Should().ContainSingle(w => w.WorkoutId == alreadyNewWorkoutId,
            "a document already on the new field names must be left exactly as-is, not emptied or duplicated");

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, noPerformanceExecutionId))
            .FirstOrDefaultAsync(ct);
        migratedExecution.Should().NotBeNull();
        migratedExecution!.Performance.Should().BeNull(
            "a document with no performance sub-document must remain null, not be corrupted or made to throw");
    }
}
