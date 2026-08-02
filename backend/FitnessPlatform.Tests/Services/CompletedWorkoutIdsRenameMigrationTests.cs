using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #857 completion-field-rename boot
/// migration in <see cref="MongoIndexInitializer"/> — the private
/// <c>MigrateCompletedWorkoutIdsRenameAsync</c> method, which <c>$rename</c>s the
/// <c>completedSectionIds</c> BSON element to <c>completedWorkoutIds</c> on both the
/// <c>sessionExecutions</c> and <c>trainingCompletions</c> collections.
/// </summary>
/// <remarks>
/// <para>
/// The method under test is <c>private</c> — it can only be exercised through the public
/// <see cref="MongoIndexInitializer.StartAsync"/> entry point. Each test seeds a legacy-shaped
/// document directly as a raw <see cref="BsonDocument"/> carrying the OLD <c>completedSectionIds</c>
/// element name (bypassing the typed <see cref="SessionExecution"/> / <see cref="TrainingCompletion"/>
/// classes entirely — those classes' <c>CompletedWorkoutIds</c> property already maps to the NEW
/// <c>completedWorkoutIds</c> element, so seeding through the typed model would write the new name
/// and the migration would have nothing to rename, proving nothing). This mirrors how real
/// pre-#857 legacy data looks on disk.
/// </para>
/// <para>
/// Uses a dedicated, per-test <see cref="MongoDbBuilder"/> container, reusing the shared
/// <see cref="MigrationTestMongoContext"/> rather than the shared suite-wide container, so the
/// exact document shapes asserted below stay independent of other test classes' fixtures and of
/// ordering within the full suite run.
/// </para>
/// </remarks>
public class CompletedWorkoutIdsRenameMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    // ── (1) SessionExecution — values survive the rename, in order ──────────────────

    [Fact]
    public async Task Rename_SessionExecutionLegacyField_ValuesSurviveUnderNewNameInOrder()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completed_workout_ids_rename_execution_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");

        var executionId = Guid.NewGuid();
        var workoutIdOne = Guid.NewGuid();
        var workoutIdTwo = Guid.NewGuid();
        var workoutIdThree = Guid.NewGuid();

        var legacyExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(executionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Partial" },
            { "completedExerciseIds", new BsonArray() },
            // NOTE: legacy element name — the pre-#857 on-disk shape.
            {
                "completedSectionIds", new BsonArray
                {
                    GuidBson(workoutIdOne), GuidBson(workoutIdTwo), GuidBson(workoutIdThree)
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
        migrated!.CompletedWorkoutIds.Should().Equal(
            [workoutIdOne, workoutIdTwo, workoutIdThree],
            "the rename must preserve every value and its original order — no loss, no reshuffle");

        var rawAfter = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId)))
            .FirstOrDefaultAsync(ct);
        rawAfter.Contains("completedSectionIds").Should().BeFalse(
            "the legacy element name must be renamed away, not merely duplicated alongside the new one");
        rawAfter.Contains("completedWorkoutIds").Should().BeTrue();
    }

    // ── (2) TrainingCompletion — values survive the rename, in order ────────────────

    [Fact]
    public async Task Rename_TrainingCompletionLegacyField_ValuesSurviveUnderNewNameInOrder()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completed_workout_ids_rename_completion_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");

        var completionId = Guid.NewGuid();
        var workoutIdOne = Guid.NewGuid();
        var workoutIdTwo = Guid.NewGuid();

        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(Guid.NewGuid()) },
            { "completedExerciseIds", new BsonArray() },
            // NOTE: legacy element name — the pre-#857 on-disk shape.
            {
                "completedSectionIds", new BsonArray
                {
                    GuidBson(workoutIdOne), GuidBson(workoutIdTwo)
                }
            },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.CompletedWorkoutIds.Should().Equal(
            [workoutIdOne, workoutIdTwo],
            "the rename must preserve every value and its original order — no loss, no reshuffle");

        var rawAfter = await rawCompletions
            .Find(new BsonDocument("externalId", GuidBson(completionId)))
            .FirstOrDefaultAsync(ct);
        rawAfter.Contains("completedSectionIds").Should().BeFalse(
            "the legacy element name must be renamed away, not merely duplicated alongside the new one");
        rawAfter.Contains("completedWorkoutIds").Should().BeTrue();
    }

    // ── (3) IDEMPOTENCY — a second boot is a clean no-op on both collections ────────

    [Fact]
    public async Task Rename_SecondBoot_IsIdempotent_NoOpOnBothCollections()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completed_workout_ids_rename_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");

        var executionId = Guid.NewGuid();
        var completionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var legacyExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(executionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Partial" },
            { "completedExerciseIds", new BsonArray() },
            { "completedSectionIds", new BsonArray { GuidBson(workoutId) } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawExecutions.InsertOneAsync(legacyExecutionDoc, cancellationToken: ct);

        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(Guid.NewGuid()) },
            { "completedExerciseIds", new BsonArray() },
            { "completedSectionIds", new BsonArray { GuidBson(workoutId) } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        // ── First boot: performs the rename on both collections ─────────────────────
        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer1.StartAsync(ct);

        var executionAfterFirstBoot = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId))).FirstOrDefaultAsync(ct);
        var completionAfterFirstBoot = await rawCompletions
            .Find(new BsonDocument("externalId", GuidBson(completionId))).FirstOrDefaultAsync(ct);

        // ── Second boot (simulating a redeploy / restart against the same database):
        // the $exists guard must find zero documents at the OLD element name and skip
        // cleanly rather than throwing or re-touching the already-migrated documents. ──
        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer2.StartAsync(ct);
        await act.Should().NotThrowAsync("re-running the migration on already-renamed data must be safe");

        var executionAfterSecondBoot = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionId))).FirstOrDefaultAsync(ct);
        var completionAfterSecondBoot = await rawCompletions
            .Find(new BsonDocument("externalId", GuidBson(completionId))).FirstOrDefaultAsync(ct);

        // BsonDocument.Equals is structural — proves the second boot mutated 0 documents,
        // not just that the typed values still happen to look right.
        executionAfterSecondBoot!.Equals(executionAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents on sessionExecutions — the already-renamed document is untouched");
        completionAfterSecondBoot!.Equals(completionAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents on trainingCompletions — the already-renamed document is untouched");

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionId))
            .FirstOrDefaultAsync(ct);
        migratedExecution!.CompletedWorkoutIds.Should().Equal(
            [workoutId], "values must still be intact after the second boot");

        var migratedCompletion = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId))
            .FirstOrDefaultAsync(ct);
        migratedCompletion!.CompletedWorkoutIds.Should().Equal(
            [workoutId], "values must still be intact after the second boot");
    }

    // ── (4) UNTOUCHED — already-renamed or field-absent documents stay intact ───────

    [Fact]
    public async Task Rename_DocumentsAlreadyOnNewFieldOrNeitherField_AreNotCorrupted()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completed_workout_ids_rename_untouched_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");

        // SessionExecution already on the NEW field name (e.g. written by post-857 code).
        var alreadyNewExecutionId = Guid.NewGuid();
        var alreadyNewWorkoutId = Guid.NewGuid();
        var alreadyNewExecutionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(alreadyNewExecutionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "status", "Partial" },
            { "completedExerciseIds", new BsonArray() },
            { "completedWorkoutIds", new BsonArray { GuidBson(alreadyNewWorkoutId) } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };
        await rawExecutions.InsertOneAsync(alreadyNewExecutionDoc, cancellationToken: ct);

        // TrainingCompletion with NEITHER field — genuinely optional (BsonIgnoreIfNull).
        var neitherFieldCompletionId = Guid.NewGuid();
        var neitherFieldCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(neitherFieldCompletionId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(Guid.NewGuid()) },
            { "completedExerciseIds", new BsonArray() },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
            // NOTE: no "completedSectionIds", no "completedWorkoutIds" at all.
        };
        await rawCompletions.InsertOneAsync(neitherFieldCompletionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync(
            "neither an already-renamed document nor a field-absent document should trip the $exists guard");

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, alreadyNewExecutionId))
            .FirstOrDefaultAsync(ct);
        migratedExecution.Should().NotBeNull();
        migratedExecution!.CompletedWorkoutIds.Should().Equal(
            [alreadyNewWorkoutId],
            "a document already on the new field name must be left exactly as-is, not emptied or duplicated");

        var migratedCompletion = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, neitherFieldCompletionId))
            .FirstOrDefaultAsync(ct);
        migratedCompletion.Should().NotBeNull();
        migratedCompletion!.CompletedWorkoutIds.Should().BeNull(
            "a document with neither field must remain null, not be corrupted into an empty list or made to throw");
    }
}
