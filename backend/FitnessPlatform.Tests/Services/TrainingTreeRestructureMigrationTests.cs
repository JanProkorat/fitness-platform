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
}
