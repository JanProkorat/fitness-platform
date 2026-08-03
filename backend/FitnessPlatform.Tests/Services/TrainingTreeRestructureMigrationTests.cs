using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) proving the #857 deletion of the three
/// legacy #837 schema-on-read boot backfills (<c>BackfillTrainingPlanSections</c>,
/// <c>BackfillWorkoutLogSections</c>, <c>BackfillTrainingCompletionVersionAndSections</c>) is
/// permanent: a pre-#837-shaped legacy document booted against
/// <see cref="MongoIndexInitializer.StartAsync"/> today is left byte-for-byte untouched, not
/// silently restructured into the synthesized "Hlavní" wrapper shape those backfills used to
/// produce. This is the absence test that stops the hazard from silently returning — with the
/// backfill gone, a future boot must leave a coach's flat exercise list untouched rather than
/// re-introducing (or worse, half-applying) the old synthesis behaviour.
/// </summary>
/// <remarks>
/// Seeds a raw <see cref="BsonDocument"/> carrying the pre-#837 flat <c>exercises</c> shape
/// (no <c>sections</c>/<c>workouts</c> field at all) directly into the <c>workoutLogs</c>
/// collection — bypassing the typed <c>WorkoutLog</c> class entirely, since it no longer
/// exposes a property to bind that legacy element through. Because the document is never
/// restructured, it can only be re-read as a raw <see cref="BsonDocument"/> afterwards, not
/// through the typed collection (which would throw a <c>BsonSerializationException</c> on the
/// unmapped <c>exercises</c> element). Uses a dedicated, per-test <see cref="MongoDbBuilder"/>
/// container, reusing the shared <see cref="MigrationTestMongoContext"/>, mirroring the sibling
/// boot-migration tests in this folder.
/// </remarks>
public class TrainingTreeRestructureMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    [Fact]
    public async Task StartAsync_LegacyFlatExerciseWorkoutLog_IsLeftUntouched_NoSynthesizedWorkoutWrapper()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_restructure_absence_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");

        var logId = Guid.NewGuid();
        var squatId = Guid.NewGuid();

        // NOTE: pre-#837 on-disk shape — flat "exercises" only, no "sections"/"workouts"
        // field at all. This is exactly the hazard the now-deleted BackfillWorkoutLogSections
        // used to guard against by synthesizing a "Hlavní" wrapper section on boot; that
        // backfill (and its TrainingPlan/TrainingCompletion siblings) is gone as of #857 — a
        // document in this shape must now be left exactly as it is, not silently restructured.
        var legacyLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddMinutes(-45) },
            { "isCompleted", true },
            { "completedAt", DateTime.UtcNow },
            {
                "exercises", new BsonArray
                {
                    new BsonDocument
                    {
                        { "exerciseExternalId", GuidBson(squatId) },
                        { "exerciseName", "Squat" },
                        {
                            "sets", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "setNumber", 1 }, { "reps", 10 }, { "weightKg", 80.0 },
                                    { "completedAt", DateTime.UtcNow.AddMinutes(-30) }, { "isPR", false }
                                }
                            }
                        }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddMinutes(-45) }
        };

        await rawLogs.InsertOneAsync(legacyLogDoc, cancellationToken: ct);

        var beforeBoot = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync(
            "a legacy flat-exercise document must not crash boot now that the synthesizing backfill is gone");

        var afterBoot = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);

        afterBoot.Should().NotBeNull();

        // BsonDocument.Equals is structural — proves boot mutated 0 fields on this document,
        // not just that a couple of spot-checked fields happen to still look right.
        afterBoot!.Equals(beforeBoot).Should().BeTrue(
            "the document must be left byte-for-byte untouched — no field added, removed, or reordered");

        afterBoot.Contains("workouts").Should().BeFalse(
            "no workouts wrapper must be synthesized now that BackfillWorkoutLogSections is deleted");
        afterBoot.Contains("sections").Should().BeFalse(
            "no legacy sections wrapper must be synthesized either");
        afterBoot["exercises"].AsBsonArray.Should().HaveCount(1,
            "the flat legacy exercise list must be preserved exactly as seeded, not wrapped or dropped");
    }

    // ── #857 phase 2: TrainingDay restructure (weeks.sessions[] + weeks.dayNotes ──────
    //    -> weeks.days[], 7 materialised days per week) ────────────────────────────────

    [Fact]
    public async Task StartAsync_LegacyFlatSessionsWithDayNotes_RestructuresIntoSevenMaterialisedDays()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_days_restructure_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionMondayId = Guid.NewGuid();
        var sessionWednesdayId = Guid.NewGuid();

        // NOTE: pre-#857-phase-2 on-disk shape — a flat "sessions" array where each session
        // embeds its own "dayOfWeek", plus a separate "dayNotes" field stored as
        // BsonDictionaryOptions(ArrayOfDocuments): an array of {"k": <int>, "v": <string>}
        // documents, NOT a plain sub-document keyed by day number.
        var legacyWeekDoc = new BsonDocument
        {
            { "weekNumber", 1 },
            { "status", "Published" },
            { "datePublished", DateTime.UtcNow },
            {
                "sessions", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionMondayId) },
                        { "dayOfWeek", 1 },
                        { "name", "Monday Session" },
                        { "order", 1 },
                        { "workouts", new BsonArray() }
                    },
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionWednesdayId) },
                        { "dayOfWeek", 3 },
                        { "name", "Wednesday Session" },
                        { "order", 1 },
                        { "workouts", new BsonArray() }
                    }
                }
            },
            {
                "dayNotes", new BsonArray
                {
                    new BsonDocument { { "k", 1 }, { "v", "Monday note" } },
                    new BsonDocument { { "k", 5 }, { "v", "Friday note" } }
                }
            }
        };

        var legacyPlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "QA restructure fixture" },
            { "status", "Active" },
            { "weeks", new BsonArray { legacyWeekDoc } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawPlans.InsertOneAsync(legacyPlanDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.Weeks.Should().ContainSingle();
        var week = migrated.Weeks[0];

        // Assertion: all 7 days exist per week (including empty ones).
        week.Days.Should().HaveCount(7);
        week.Days.Select(d => d.DayOfWeek).Should().Equal([1, 2, 3, 4, 5, 6, 7]);

        // Assertion: sessions land under the correct day.
        var monday = week.Days.Single(d => d.DayOfWeek == 1);
        monday.Sessions.Should().ContainSingle(s => s.SessionId == sessionMondayId);

        var wednesday = week.Days.Single(d => d.DayOfWeek == 3);
        wednesday.Sessions.Should().ContainSingle(s => s.SessionId == sessionWednesdayId);

        var tuesday = week.Days.Single(d => d.DayOfWeek == 2);
        tuesday.Sessions.Should().BeEmpty("a day with no sessions is a rest day, not an absent day");

        // Assertion: notes land on the right day.
        monday.Note.Should().Be("Monday note");
        var friday = week.Days.Single(d => d.DayOfWeek == 5);
        friday.Note.Should().Be("Friday note", "the note must land on Friday even though Friday has no sessions");
        friday.Sessions.Should().BeEmpty();

        // Assertion: dayNotes and session.dayOfWeek are gone (raw BSON check — the typed
        // TrainingWeek/TrainingSession no longer expose either field at all, so the only way
        // to prove they are actually absent on disk, not merely unmapped, is a raw read).
        var rawAfter = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);
        var rawWeek = rawAfter["weeks"].AsBsonArray[0].AsBsonDocument;
        rawWeek.Contains("sessions").Should().BeFalse("the legacy flat sessions field must be removed");
        rawWeek.Contains("dayNotes").Should().BeFalse("the legacy dayNotes field must be removed");
        rawWeek.Contains("days").Should().BeTrue();

        foreach (var rawDay in rawWeek["days"].AsBsonArray)
        {
            foreach (var rawSession in rawDay.AsBsonDocument["sessions"].AsBsonArray)
            {
                rawSession.AsBsonDocument.Contains("dayOfWeek").Should().BeFalse(
                    "dayOfWeek must be dropped from the session — the parent day owns it now");
            }
        }
    }

    [Fact]
    public async Task StartAsync_SessionWithInvalidOrMissingDayOfWeek_IsParkedOnDayOneNotDropped()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_invalid_dayofweek_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionMissingDayOfWeekId = Guid.NewGuid();
        var sessionZeroDayOfWeekId = Guid.NewGuid();
        var sessionOutOfRangeDayOfWeekId = Guid.NewGuid();

        // A migration must not delete user data behind a log line. dayOfWeek absent, dayOfWeek
        // == 0, and an out-of-range dayOfWeek must all survive the restructure — parked on day 1
        // (deterministic, inspectable), never dropped.
        var legacyWeekDoc = new BsonDocument
        {
            { "weekNumber", 1 },
            { "status", "Published" },
            { "datePublished", DateTime.UtcNow },
            {
                "sessions", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionMissingDayOfWeekId) },
                        // dayOfWeek intentionally absent.
                        { "name", "No DayOfWeek Session" },
                        { "order", 1 },
                        { "workouts", new BsonArray() }
                    },
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionZeroDayOfWeekId) },
                        { "dayOfWeek", 0 },
                        { "name", "Zero DayOfWeek Session" },
                        { "order", 2 },
                        { "workouts", new BsonArray() }
                    },
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionOutOfRangeDayOfWeekId) },
                        { "dayOfWeek", 9 },
                        { "name", "Out Of Range DayOfWeek Session" },
                        { "order", 3 },
                        { "workouts", new BsonArray() }
                    }
                }
            }
        };

        var legacyPlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "QA invalid dayOfWeek fixture" },
            { "status", "Active" },
            { "weeks", new BsonArray { legacyWeekDoc } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawPlans.InsertOneAsync(legacyPlanDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        var week = migrated!.Weeks.Should().ContainSingle().Subject;
        week.Days.Should().HaveCount(7);

        var monday = week.Days.Single(d => d.DayOfWeek == 1);
        monday.Sessions.Should().HaveCount(3,
            "all three sessions with an absent, zero, or out-of-range dayOfWeek must be parked " +
            "on day 1, not dropped");
        monday.Sessions.Select(s => s.SessionId).Should().BeEquivalentTo(
        [
            sessionMissingDayOfWeekId,
            sessionZeroDayOfWeekId,
            sessionOutOfRangeDayOfWeekId
        ]);
    }

    [Fact]
    public async Task StartAsync_SecondBootAfterDaysRestructure_IsIdempotent_NoOpOnAlreadyMigratedDocument()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_days_restructure_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        var legacyWeekDoc = new BsonDocument
        {
            { "weekNumber", 1 },
            { "status", "Published" },
            { "datePublished", DateTime.UtcNow },
            {
                "sessions", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sessionId", GuidBson(sessionId) },
                        { "dayOfWeek", 2 },
                        { "name", "Tuesday Session" },
                        { "order", 1 },
                        { "workouts", new BsonArray() }
                    }
                }
            }
        };

        var legacyPlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "QA restructure idempotency fixture" },
            { "status", "Active" },
            { "weeks", new BsonArray { legacyWeekDoc } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawPlans.InsertOneAsync(legacyPlanDoc, cancellationToken: ct);

        // ── First boot: performs the restructure ─────────────────────────────────────
        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer1.StartAsync(ct);

        var rawAfterFirstBoot = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);

        // ── Second boot (simulating a redeploy / restart against the same database):
        // the $exists guard on the legacy "weeks.sessions" shape must find zero matching
        // documents and skip cleanly rather than throwing or re-touching the document. ──
        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer2.StartAsync(ct);
        await act.Should().NotThrowAsync("re-running the migration on an already-restructured document must be safe");

        var rawAfterSecondBoot = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);

        // BsonDocument.Equals is structural — proves the second boot mutated 0 documents,
        // not just that the typed values still happen to look right.
        rawAfterSecondBoot!.Equals(rawAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents — the already-restructured document is untouched");

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        migrated!.Weeks[0].Days.Should().HaveCount(7, "the day structure must still be intact after the second boot");
        migrated.Weeks[0].Days.Single(d => d.DayOfWeek == 2).Sessions
            .Should().ContainSingle(s => s.SessionId == sessionId);
    }

    [Fact]
    public async Task StartAsync_DocumentAlreadyOnDaysShape_IsLeftUntouched()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_days_restructure_untouched_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        // A document already on the NEW days shape (e.g. written by post-#857 code, or a
        // plan with no sessions at all yet) — must NOT match the legacy "weeks.sessions"
        // $exists filter, so the migration leaves it completely untouched.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        var newShapeWeekDoc = new BsonDocument
        {
            { "weekNumber", 1 },
            { "status", "Draft" },
            {
                "days", new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
                    new BsonDocument
                    {
                        { "dayOfWeek", dayOfWeek },
                        {
                            "sessions", dayOfWeek == 4
                                ? new BsonArray
                                {
                                    new BsonDocument
                                    {
                                        { "sessionId", GuidBson(sessionId) },
                                        { "name", "Thursday Session" },
                                        { "order", 1 },
                                        { "workouts", new BsonArray() }
                                    }
                                }
                                : new BsonArray()
                        }
                    }))
            }
        };

        var newShapePlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "QA already-migrated fixture" },
            { "status", "Draft" },
            { "weeks", new BsonArray { newShapeWeekDoc } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-1) }
        };

        await rawPlans.InsertOneAsync(newShapePlanDoc, cancellationToken: ct);

        var beforeBoot = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var afterBoot = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);

        afterBoot!.Equals(beforeBoot).Should().BeTrue(
            "a document already on the new days shape must be left byte-for-byte untouched");

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        migrated!.Weeks[0].Days.Should().HaveCount(7);
        migrated.Weeks[0].Days.Single(d => d.DayOfWeek == 4).Sessions
            .Should().ContainSingle(s => s.SessionId == sessionId);
    }

    // ── AC 3 / AC 9: a FULL pre-#857 database boots clean, twice ────────────────────────
    //
    // Every other test in this file (and its #857 siblings — WorkoutSectionsToWorkoutsRename-
    // MigrationTests, CompletedWorkoutIdsRenameMigrationTests, SessionExerciseIdBackfillMigration-
    // Tests, CompletionExerciseInstanceIdsMigrationTests) proves ONE migration step in isolation,
    // most of them by seeding a fixture that is already in the CURRENT (post-#857) shape for
    // everything except the one field/collection under test. None of them reproduces the two
    // boot-order hazards the design review named specifically for the template-collection swap:
    // IndexOptionsConflict (a stale renamed-in index collides by KEY — not by name — with the
    // newly-named index CreateSessionTemplateIndexes/CreateWorkoutTemplateIndexes tries to
    // create) and NamespaceExists(48) (an index-creation method run BEFORE the rename would
    // implicitly create an empty target collection via CreateManyAsync, and renameCollection
    // then fails against an existing target). Both are invisible on a fresh Testcontainers
    // database — neither legacy physical collection nor legacy index exists there — which is
    // exactly why the full suite staying green was never evidence that a real pre-#857 dev
    // database (or the compose harness) would boot cleanly.
    //
    // This test seeds the FULL pre-#857 physical shape in one database: the two legacy template
    // collections under their OLD physical names with their OLD colliding indexes (exact names
    // recovered from git history — see the code comments on
    // MigrateWorkoutTemplateCollectionSwapAsync), a trainingPlans document in the old flat-
    // sessions/dayNotes shape (no exerciseId anywhere), a workoutLogs document in the old
    // top-level "sections" shape, and BOTH un-consolidated legacy completion collections
    // (trainingCompletions AND sessionExecutions) in the old completedSectionIds/
    // completedExerciseIdsBySection shape — then boots StartAsync TWICE, asserting neither boot
    // throws (idempotency, AC bullet 9) and that every hazard was actually closed, not merely
    // avoided by coincidence: the stale indexes are gone, document identity survived the
    // collection swap, and the completion records resolved onto the newly-backfilled ExerciseId
    // rather than being silently dropped.
    [Fact]
    public async Task StartAsync_FullPre857DatabaseShape_BootsCleanTwice_NoIndexConflictOrNamespaceExists()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_full_pre857_boot_test");
        var mongo = new MigrationTestMongoContext(db);

        var sessionDate = new DateTime(2024, 1, 8, 0, 0, 0, DateTimeKind.Utc); // a Monday

        // ── 1. Legacy template collections under their OLD physical names, with their OLD
        // colliding indexes (design-review GATE 2 / GATE 2b). Index names/keys recovered from
        // git history — pre-#857, the misnamed WorkoutTemplate type (a whole session skeleton,
        // now SessionTemplate) indexed "externalId"/"ownerId" as idx_workouttemplate_*, and
        // SectionTemplate (now WorkoutTemplate) indexed "externalId"/"ownerTrainerId" as
        // idx_sectiontemplate_*. Both key paths survive the rename unchanged on the C# side
        // (SessionTemplate.OwnerId and WorkoutTemplate.OwnerTrainerId keep the same BSON element
        // names), so the carried-over stale index collides by KEY with the freshly-named one. ──

        var oldWorkoutTemplateExternalId = Guid.NewGuid(); // -> becomes a SessionTemplate
        var oldSectionTemplateExternalId = Guid.NewGuid(); // -> becomes a WorkoutTemplate

        // The template's legacy "sections"/"sectionId" shape must be POPULATED here (not an
        // empty/absent array) — an empty array never exercises the unmapped-extra-element
        // BsonSerializationException the #857 template rewrite exists to prevent; only a
        // document that still carries a real "sections" element at the point of the first typed
        // SessionTemplate read proves the rewrite actually ran.
        var oldWorkoutTemplateWorkoutId = Guid.NewGuid();
        var oldWorkoutTemplateExerciseExternalId = Guid.NewGuid();

        var rawOldWorkoutTemplates = db.GetCollection<BsonDocument>("workoutTemplates");
        await rawOldWorkoutTemplates.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(oldWorkoutTemplateExternalId) },
            { "ownerId", GuidBson(Guid.NewGuid()) },
            { "name", "Full Body A" },
            {
                "sections", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(oldWorkoutTemplateWorkoutId) },
                        { "order", 0 },
                        { "name", "Hlavni" },
                        {
                            "exercises", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "exerciseExternalId", GuidBson(oldWorkoutTemplateExerciseExternalId) },
                                    { "exerciseName", "Squat" },
                                    { "order", 1 },
                                    { "sets", new BsonArray() }
                                }
                            }
                        }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddDays(-30) },
            { "version", 1 }
        }, cancellationToken: ct);

        await rawOldWorkoutTemplates.Indexes.CreateManyAsync(
        [
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("externalId"),
                new CreateIndexOptions { Name = "idx_workouttemplate_externalId", Unique = true }),
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("ownerId"),
                new CreateIndexOptions { Name = "idx_workouttemplate_ownerId" })
        ], ct);

        var rawOldSectionTemplates = db.GetCollection<BsonDocument>("sectionTemplates");
        await rawOldSectionTemplates.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(oldSectionTemplateExternalId) },
            { "ownerTrainerId", GuidBson(Guid.NewGuid()) },
            { "name", "Warm-up" },
            { "defaultExercises", new BsonArray() },
            { "createdAt", DateTime.UtcNow.AddDays(-30) },
            { "updatedAt", DateTime.UtcNow.AddDays(-30) },
            { "version", 1 }
        }, cancellationToken: ct);

        await rawOldSectionTemplates.Indexes.CreateManyAsync(
        [
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("externalId"),
                new CreateIndexOptions { Name = "idx_sectiontemplate_externalId", Unique = true }),
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("ownerTrainerId"),
                new CreateIndexOptions { Name = "idx_sectiontemplate_ownerTrainerId" })
        ], ct);

        // ── 2. A trainingPlans document in the full old flat-sessions/dayNotes shape — no
        // "days" array, no "exerciseId" on any exercise, and the session's workout block still
        // under the legacy "sections"/"sectionId" keys (#857 phase 2b) — with one workout-nested
        // exercise AND one standalone exercise so the exerciseId backfill (#857 phase 3a) is
        // exercised too. Seeding "sections"/"sectionId" here (rather than the post-857
        // "workouts"/"workoutId" keys) is deliberate: it is exactly the shape that made
        // BuildClientSessionLookupAsync's typed TrainingPlan read throw before the #857 phase 2b
        // migration existed — see the design-review round-2 finding this fixture closes. ──

        var planId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var workoutExerciseExternalId = Guid.NewGuid();
        var standaloneExerciseExternalId = Guid.NewGuid();

        var legacySessionDoc = new BsonDocument
        {
            { "sessionId", GuidBson(sessionId) },
            { "dayOfWeek", 2 },
            { "name", "Push Day" },
            { "order", 1 },
            {
                "sections", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(workoutId) },
                        { "order", 0 },
                        { "name", "Hlavni" },
                        {
                            "exercises", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "exerciseExternalId", GuidBson(workoutExerciseExternalId) },
                                    { "exerciseName", "Bench Press" },
                                    { "order", 1 },
                                    { "sets", new BsonArray() }
                                }
                            }
                        }
                    }
                }
            },
            {
                "exercises", new BsonArray
                {
                    new BsonDocument
                    {
                        { "exerciseExternalId", GuidBson(standaloneExerciseExternalId) },
                        { "exerciseName", "Plank" },
                        { "order", 2 },
                        { "sets", new BsonArray() }
                    }
                }
            }
        };

        var legacyWeekDoc = new BsonDocument
        {
            { "weekNumber", 1 },
            { "status", "Published" },
            { "datePublished", sessionDate.AddDays(-1) },
            { "sessions", new BsonArray { legacySessionDoc } },
            {
                "dayNotes", new BsonArray
                {
                    new BsonDocument { { "k", 2 }, { "v", "Push day note" } }
                }
            }
        };

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");
        await rawPlans.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(clientId) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "Full pre-857 boot fixture" },
            { "status", "Active" },
            { "weeks", new BsonArray { legacyWeekDoc } },
            { "version", 1 },
            { "dateCreated", sessionDate.AddDays(-30) }
        }, cancellationToken: ct);

        // ── 3. A workoutLogs document in the old top-level "sections" shape (renamed to
        // "workouts" — and nested "sectionId" to "workoutId" — by #857 step 6). ─────────────

        var logId = Guid.NewGuid();
        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");
        await rawLogs.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logId) },
            { "clientId", GuidBson(clientId) },
            { "startedAt", sessionDate.AddHours(-1) },
            { "isCompleted", true },
            { "completedAt", sessionDate },
            {
                "sections", new BsonArray
                {
                    new BsonDocument
                    {
                        { "sectionId", GuidBson(workoutId) },
                        { "name", "Hlavni" },
                        { "exercises", new BsonArray() }
                    }
                }
            },
            { "dateCreated", sessionDate.AddHours(-1) }
        }, cancellationToken: ct);

        // ── 4. Un-consolidated legacy completion data — BOTH trainingCompletions and
        // sessionExecutions in the old completedSectionIds/completedExerciseIdsBySection shape,
        // resolving against the workout exercise seeded above (#857 phase 3b). ───────────────

        var bySection = new BsonDocument
        {
            { workoutId.ToString(), new BsonArray { GuidBson(workoutExerciseExternalId) } }
        };

        var completionExternalId = Guid.NewGuid();
        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");
        await rawCompletions.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionExternalId) },
            { "clientId", GuidBson(clientId) },
            { "date", sessionDate },
            { "sessionId", GuidBson(sessionId) },
            { "completedExerciseIds", new BsonArray() },
            { "completedExerciseIdsBySection", bySection },
            { "completedSectionIds", new BsonArray { GuidBson(workoutId) } },
            { "dateCreated", sessionDate },
            { "version", 1 }
        }, cancellationToken: ct);

        var executionExternalId = Guid.NewGuid();
        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(executionExternalId) },
            { "clientId", GuidBson(clientId) },
            { "planId", GuidBson(planId) },
            { "sessionId", GuidBson(sessionId) },
            { "date", sessionDate },
            { "status", "Partial" },
            { "completedExerciseIds", new BsonArray() },
            { "completedExerciseIdsBySection", bySection },
            { "completedSectionIds", new BsonArray { GuidBson(workoutId) } },
            { "dateCreated", sessionDate },
            { "version", 1 }
        }, cancellationToken: ct);

        // ── First boot: must run every #857 migration in order and not throw either the
        // IndexOptionsConflict or the NamespaceExists(48) hazard the design review named. ──

        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var firstBoot = async () => await initializer1.StartAsync(ct);
        await firstBoot.Should().NotThrowAsync(
            "a pre-#857 database must boot cleanly — the collection swap must be hoisted above " +
            "every Create*Indexes call, and the stale renamed-in indexes must be dropped before " +
            "the correctly-named ones are created");

        // ── Collection swap: physical identity, not just non-throw ──────────────────────────

        var collectionNamesCursorAfterFirstBoot = await db.ListCollectionNamesAsync(cancellationToken: ct);
        var namesAfterFirstBoot = await collectionNamesCursorAfterFirstBoot.ToListAsync(ct);
        namesAfterFirstBoot.Should().Contain("sessionTemplates").And.Contain("workoutTemplates");
        namesAfterFirstBoot.Should().NotContain("sectionTemplates",
            "the legacy physical collection must not survive the swap under its old name");

        var migratedSessionTemplate = await mongo.SessionTemplates
            .Find(Builders<SessionTemplate>.Filter.Eq(t => t.ExternalId, oldWorkoutTemplateExternalId))
            .FirstOrDefaultAsync(ct);
        migratedSessionTemplate.Should().NotBeNull(
            "the ex-workoutTemplates document must be readable as a SessionTemplate after the swap");
        migratedSessionTemplate!.Name.Should().Be("Full Body A");

        // Typed read-back proper: the legacy "sections" array must have been rewritten to
        // "workouts" (and nested "sectionId" to "workoutId") — a raw BSON check alone would not
        // catch a rewrite that ran but produced the wrong shape; only a successful typed
        // deserialization plus correct values proves the rewrite closed the
        // BsonSerializationException hazard for real template data.
        var migratedTemplateWorkout = migratedSessionTemplate.Workouts.Should().ContainSingle().Subject;
        migratedTemplateWorkout.WorkoutId.Should().Be(oldWorkoutTemplateWorkoutId,
            "the legacy sectionId must survive the rename to workoutId, not be regenerated");
        migratedTemplateWorkout.Exercises.Should().ContainSingle()
            .Which.ExerciseExternalId.Should().Be(oldWorkoutTemplateExerciseExternalId);

        var rawSessionTemplateAfterFirstBoot = await db.GetCollection<BsonDocument>("sessionTemplates")
            .Find(new BsonDocument("externalId", GuidBson(oldWorkoutTemplateExternalId)))
            .FirstOrDefaultAsync(ct);
        rawSessionTemplateAfterFirstBoot.Contains("sections").Should().BeFalse(
            "the legacy sections field must be removed, not left alongside the new workouts field");
        rawSessionTemplateAfterFirstBoot.Contains("workouts").Should().BeTrue();
        var rawMigratedTemplateWorkout = rawSessionTemplateAfterFirstBoot["workouts"].AsBsonArray[0].AsBsonDocument;
        rawMigratedTemplateWorkout.Contains("sectionId").Should().BeFalse();
        rawMigratedTemplateWorkout.Contains("workoutId").Should().BeTrue();

        var migratedWorkoutTemplate = await mongo.WorkoutTemplates
            .Find(Builders<WorkoutTemplate>.Filter.Eq(t => t.ExternalId, oldSectionTemplateExternalId))
            .FirstOrDefaultAsync(ct);
        migratedWorkoutTemplate.Should().NotBeNull(
            "the ex-sectionTemplates document must be readable as a WorkoutTemplate after the swap");
        migratedWorkoutTemplate!.Name.Should().Be("Warm-up");

        // ── Stale indexes must actually be gone, not merely non-conflicting by luck ─────────

        var sessionTemplateIndexCursor = await mongo.SessionTemplates.Indexes.ListAsync(ct);
        var sessionTemplateIndexNames = (await sessionTemplateIndexCursor.ToListAsync(ct))
            .Select(index => index["name"].AsString)
            .ToList();
        sessionTemplateIndexNames.Should().Contain("idx_sessiontemplate_externalId")
            .And.Contain("idx_sessiontemplate_ownerId");
        sessionTemplateIndexNames.Should().NotContain("idx_workouttemplate_externalId")
            .And.NotContain("idx_workouttemplate_ownerId",
                "the stale renamed-in indexes must be dropped, not merely left alongside the new ones");

        var workoutTemplateIndexCursor = await mongo.WorkoutTemplates.Indexes.ListAsync(ct);
        var workoutTemplateIndexNames = (await workoutTemplateIndexCursor.ToListAsync(ct))
            .Select(index => index["name"].AsString)
            .ToList();
        workoutTemplateIndexNames.Should().Contain("idx_workouttemplate_externalId")
            .And.Contain("idx_workouttemplate_ownerTrainerId");
        workoutTemplateIndexNames.Should().NotContain("idx_sectiontemplate_externalId")
            .And.NotContain("idx_sectiontemplate_ownerTrainerId");

        // ── TrainingPlan: fully restructured to the day-level model, ExerciseId assigned ────

        var migratedPlan = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        migratedPlan.Should().NotBeNull();
        var migratedWeek = migratedPlan!.Weeks.Should().ContainSingle().Subject;
        migratedWeek.Days.Should().HaveCount(7);

        var migratedDay = migratedWeek.Days.Single(d => d.DayOfWeek == 2);
        migratedDay.Note.Should().Be("Push day note");
        var migratedSession = migratedDay.Sessions.Should().ContainSingle().Subject;
        migratedSession.SessionId.Should().Be(sessionId);

        var migratedWorkout = migratedSession.Workouts.Should().ContainSingle().Subject;
        migratedWorkout.WorkoutId.Should().Be(workoutId,
            "the legacy sectionId must survive the #857 phase 2b rename to workoutId, not be regenerated");
        var migratedWorkoutExercise = migratedWorkout.Exercises.Should().ContainSingle().Subject;
        migratedWorkoutExercise.ExerciseId.Should().NotBe(Guid.Empty,
            "the exerciseId backfill must assign a fresh instance id to every pre-existing exercise");

        var migratedStandaloneExercise = migratedSession.StandaloneExercises.Should().ContainSingle().Subject;
        migratedStandaloneExercise.ExerciseId.Should().NotBe(Guid.Empty);
        migratedStandaloneExercise.ExerciseId.Should().NotBe(migratedWorkoutExercise.ExerciseId,
            "the standalone exercise and the nested workout exercise must get distinct instance ids");

        // ── TrainingPlan session: sections -> workouts (and nested sectionId -> workoutId)
        // rename actually happened on disk, not just on the typed read above (raw BSON check —
        // the whole point of #857 phase 2b is that the OLD keys are gone, not merely unmapped). ──

        var rawPlanAfterFirstBoot = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);
        var rawMigratedSession = rawPlanAfterFirstBoot["weeks"].AsBsonArray[0].AsBsonDocument["days"].AsBsonArray
            .Select(d => d.AsBsonDocument)
            .Single(d => d["dayOfWeek"].AsInt32 == 2)["sessions"].AsBsonArray[0].AsBsonDocument;
        rawMigratedSession.Contains("sections").Should().BeFalse(
            "the legacy sections field must be removed, not left alongside the new workouts field");
        rawMigratedSession.Contains("workouts").Should().BeTrue();
        var rawMigratedWorkout = rawMigratedSession["workouts"].AsBsonArray[0].AsBsonDocument;
        rawMigratedWorkout.Contains("sectionId").Should().BeFalse();
        rawMigratedWorkout.Contains("workoutId").Should().BeTrue();
        rawMigratedWorkout["exercises"].AsBsonArray[0].AsBsonDocument.Contains("exerciseId").Should().BeTrue(
            "every exercise nested under the renamed workout must carry the #857 phase 3a exerciseId backfill");
        rawMigratedSession["exercises"].AsBsonArray[0].AsBsonDocument.Contains("exerciseId").Should().BeTrue(
            "the standalone exercise must also carry the #857 phase 3a exerciseId backfill");

        // ── WorkoutLog: sections -> workouts (and nested sectionId -> workoutId) rename ─────

        var migratedLog = await mongo.WorkoutLogs
            .Find(Builders<WorkoutLog>.Filter.Eq(w => w.ExternalId, logId))
            .FirstOrDefaultAsync(ct);
        migratedLog.Should().NotBeNull();
        migratedLog!.Workouts.Should().ContainSingle().Which.WorkoutId.Should().Be(workoutId);

        // ── Completion resolution: BOTH legacy collections resolved onto the freshly-backfilled
        // workout exercise's ExerciseId, and none of the retired fields survive. ────────────────

        var migratedCompletion = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionExternalId))
            .FirstOrDefaultAsync(ct);
        migratedCompletion.Should().NotBeNull();
        migratedCompletion!.CompletedExerciseInstanceIds.Should().Equal([migratedWorkoutExercise.ExerciseId]);
        migratedCompletion.CompletedWorkoutIds.Should().Equal([workoutId]);

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionExternalId))
            .FirstOrDefaultAsync(ct);
        migratedExecution.Should().NotBeNull();
        migratedExecution!.CompletedExerciseInstanceIds.Should().Equal([migratedWorkoutExercise.ExerciseId]);
        migratedExecution.CompletedWorkoutIds.Should().Equal([workoutId]);

        var rawCompletionAfterFirstBoot = await rawCompletions
            .Find(new BsonDocument("externalId", GuidBson(completionExternalId)))
            .FirstOrDefaultAsync(ct);
        rawCompletionAfterFirstBoot.Contains("completedExerciseIdsBySection").Should().BeFalse();
        rawCompletionAfterFirstBoot.Contains("completedExerciseIds").Should().BeFalse();
        rawCompletionAfterFirstBoot.Contains("completedSectionIds").Should().BeFalse(
            "the field rename must remove the old completedSectionIds element, not just add the new one");

        // ── Second boot: every migration's own idempotency guard must find nothing left to do,
        // and boot must still not throw — this is the AC bullet 9 assertion proper. ───────────

        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var secondBoot = async () => await initializer2.StartAsync(ct);
        await secondBoot.Should().NotThrowAsync(
            "re-running the full #857 migration chain against an already-migrated database must be a clean no-op");

        var collectionNamesCursorAfterSecondBoot = await db.ListCollectionNamesAsync(cancellationToken: ct);
        var namesAfterSecondBoot = await collectionNamesCursorAfterSecondBoot.ToListAsync(ct);
        namesAfterSecondBoot.Should().BeEquivalentTo(namesAfterFirstBoot,
            "a second boot must not create, drop, or rename any collection");

        var sessionTemplateIndexCursorAfterSecondBoot = await mongo.SessionTemplates.Indexes.ListAsync(ct);
        var sessionTemplateIndexNamesAfterSecondBoot = (await sessionTemplateIndexCursorAfterSecondBoot.ToListAsync(ct))
            .Select(index => index["name"].AsString)
            .ToList();
        sessionTemplateIndexNamesAfterSecondBoot.Should().BeEquivalentTo(sessionTemplateIndexNames,
            "a second boot must not touch the SessionTemplates indexes at all");

        var rawCompletionAfterSecondBoot = await rawCompletions
            .Find(new BsonDocument("externalId", GuidBson(completionExternalId)))
            .FirstOrDefaultAsync(ct);
        rawCompletionAfterSecondBoot!.Equals(rawCompletionAfterFirstBoot).Should().BeTrue(
            "a second boot must not rewrite an already-migrated trainingCompletions document");

        var rawSessionTemplateAfterSecondBoot = await db.GetCollection<BsonDocument>("sessionTemplates")
            .Find(new BsonDocument("externalId", GuidBson(oldWorkoutTemplateExternalId)))
            .FirstOrDefaultAsync(ct);
        rawSessionTemplateAfterSecondBoot!.Equals(rawSessionTemplateAfterFirstBoot).Should().BeTrue(
            "a second boot must not rewrite an already-migrated sessionTemplates document");
    }
}
