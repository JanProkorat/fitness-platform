using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #837 retire-schema-on-read boot
/// migration in <see cref="MongoIndexInitializer"/>:
/// <list type="bullet">
///   <item><description>TrainingSession (embedded in TrainingPlan) — legacy flat <c>exercises</c>
///     backfilled into a single "Hlavní" section; legacy field unset.</description></item>
///   <item><description>WorkoutLog — same backfill, flat document-level.</description></item>
///   <item><description>TrainingCompletion — <c>Version</c> backfill for field-absent legacy
///     docs (guards the documented Eq(version,0) incident), and
///     <c>CompletedExerciseIdsBySection</c> backfill resolved via the owning
///     TrainingPlan/TrainingSession (the completion carries SessionId but no PlanId).</description></item>
/// </list>
/// Each test seeds a legacy-shaped document directly as a raw <see cref="BsonDocument"/>
/// (bypassing the C# document classes, which no longer have a <c>LegacyExercises</c>
/// property to construct that shape through — this mirrors how real legacy data written
/// before #837 looks on disk), runs <see cref="MongoIndexInitializer.StartAsync"/> against a
/// fresh, dedicated Testcontainer, then asserts the migrated shape / read-equivalence /
/// idempotency directly against the resulting documents.
/// </summary>
public class PlanSchemaOnReadMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    // ── (1) TrainingPlan / TrainingSession sections backfill ─────────────────────

    [Fact]
    public async Task TrainingPlanSessions_LegacyFlatExercises_MigrateToHlavniSectionAndUnsetLegacyField()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("plan_sections_backfill_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var squatId = Guid.NewGuid();
        var benchId = Guid.NewGuid();

        var legacyPlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "Legacy Flat Plan" },
            { "status", "Active" },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-30) },
            {
                "weeks", new BsonArray
                {
                    new BsonDocument
                    {
                        { "weekNumber", 1 },
                        { "status", "Published" },
                        { "datePublished", DateTime.UtcNow.AddDays(-20) },
                        {
                            "sessions", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "sessionId", GuidBson(sessionId) },
                                    { "dayOfWeek", 2 },
                                    { "name", "Legacy Day" },
                                    { "order", 1 }
                                    // NOTE: no "sections" field, flat "exercises" only —
                                    // exactly the pre-#XXX on-disk shape.
                                    ,
                                    {
                                        "exercises", new BsonArray
                                        {
                                            new BsonDocument
                                            {
                                                { "exerciseExternalId", GuidBson(squatId) },
                                                { "exerciseName", "Squat" },
                                                { "order", 1 },
                                                { "movementType", "Reps" },
                                                {
                                                    "sets", new BsonArray
                                                    {
                                                        new BsonDocument
                                                        {
                                                            { "setNumber", 1 }, { "type", "Normal" },
                                                            { "reps", 5 }, { "weightKg", 100.0 }
                                                        }
                                                    }
                                                }
                                            },
                                            new BsonDocument
                                            {
                                                { "exerciseExternalId", GuidBson(benchId) },
                                                { "exerciseName", "Bench Press" },
                                                { "order", 2 },
                                                { "movementType", "Reps" },
                                                {
                                                    "sets", new BsonArray
                                                    {
                                                        new BsonDocument
                                                        {
                                                            { "setNumber", 1 }, { "type", "Normal" },
                                                            { "reps", 8 }, { "weightKg", 80.0 }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await rawPlans.InsertOneAsync(legacyPlanDoc, cancellationToken: ct);

        // ── Run the migration ──────────────────────────────────────────────────────
        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        // ── Assert: typed read now succeeds and reflects the migrated shape ─────────
        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        var session = migrated!.Weeks[0].Sessions[0];

        session.Sections.Should().HaveCount(1, "the legacy flat exercises must be wrapped in a single default section");
        var hlavni = session.Sections[0];
        hlavni.Name.Should().Be("Hlavní");
        hlavni.Order.Should().Be(0);
        hlavni.Format.Should().BeNull("the synthesized section carries no format override");
        hlavni.Exercises.Should().HaveCount(2);
        hlavni.Exercises.Select(e => e.ExerciseExternalId).Should().ContainInOrder(squatId, benchId);

        // Flat backward-compat accessor derives cleanly from Sections.
        session.Exercises.Should().HaveCount(2);

        // ── Assert: legacy field literally unset from the raw document ─────────────
        var rawAfter = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);
        var rawSession = rawAfter["weeks"][0]["sessions"][0].AsBsonDocument;
        rawSession.Contains("exercises").Should().BeFalse("the legacy flat field must be $unset by the migration");
        rawSession.Contains("sections").Should().BeTrue();
    }

    // ── (2) WorkoutLog sections backfill ──────────────────────────────────────────

    [Fact]
    public async Task WorkoutLogSections_LegacyFlatExercises_MigrateToHlavniSectionAndUnsetLegacyField()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("workoutlog_sections_backfill_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");

        var logId = Guid.NewGuid();
        var squatId = Guid.NewGuid();

        var legacyLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddMinutes(-45) },
            { "isCompleted", true },
            { "completedAt", DateTime.UtcNow },
            {
                "wodResult", new BsonDocument
                {
                    { "roundsCompleted", 5 },
                    { "extraReps", 3 }
                }
            },
            // NOTE: no "sections" field — legacy flat "exercises" only.
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

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.WorkoutLogs
            .Find(Builders<WorkoutLog>.Filter.Eq(l => l.ExternalId, logId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.Sections.Should().HaveCount(1);
        var hlavni = migrated.Sections[0];
        hlavni.Name.Should().Be("Hlavní");
        hlavni.Exercises.Should().HaveCount(1);
        hlavni.Exercises[0].ExerciseExternalId.Should().Be(squatId);
        hlavni.WodResult.Should().NotBeNull("the session-level wodResult must carry over to the synthesized section");

        var rawAfter = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);
        rawAfter.Contains("exercises").Should().BeFalse("the legacy flat field must be $unset by the migration");
    }

    // ── (3) TrainingCompletion Version backfill guards the Eq(version,0) incident ─

    [Fact]
    public async Task TrainingCompletion_VersionFieldAbsent_BackfillsToOne_SubsequentOptimisticConcurrencyUpdateMatches()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_version_backfill_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");

        var completionId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(clientId) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(sessionId) },
            { "completedExerciseIds", new BsonArray() },
            { "dateCreated", DateTime.UtcNow.AddDays(-10) }
            // NOTE: no "version" field at all — the pre-Version-field legacy shape.
        };

        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.Version.Should().Be(1, "the backfill sets a concrete persisted value matching the C# initializer default");

        // ── Prove the documented incident is actually fixed: an Eq(version, 1) filtered
        // update must MATCH the persisted document (would have matched zero documents had
        // the migration used the wrong filter, e.g. Eq(version, 0), or never persisted the
        // field at all — the field-absent doc would deserialize to 1 in memory but the
        // on-disk document would still lack the field, so the equality filter would silently
        // find nothing and every subsequent optimistic-concurrency write would 409 forever).
        var versionedFilter = Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId)
                              & Builders<TrainingCompletion>.Filter.Eq(c => c.Version, 1);
        var update = Builders<TrainingCompletion>.Update
            .Set(c => c.CompletedSectionIds, new List<Guid> { Guid.NewGuid() })
            .Set(c => c.Version, 2);

        var updateResult = await mongo.TrainingCompletions.UpdateOneAsync(versionedFilter, update, cancellationToken: ct);
        updateResult.MatchedCount.Should().Be(1,
            "the Eq(version, 1) filter must match the backfilled document — proving the field was actually persisted, not just deserialized in memory");
        updateResult.ModifiedCount.Should().Be(1);
    }

    // ── (4) TrainingCompletion CompletedExerciseIdsBySection backfill via plan lookup ─

    [Fact]
    public async Task TrainingCompletion_LegacyFlatCompletedIds_BackfillsBySection_MatchingGetEffectiveCompletedExerciseIdsBySection()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_bysection_backfill_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var sectionAId = Guid.NewGuid();
        var sectionBId = Guid.NewGuid();
        var exerciseInA = Guid.NewGuid();
        var exerciseInB = Guid.NewGuid();
        var orphanExerciseId = Guid.NewGuid(); // no longer present in the resolved session

        // ── Seed a MODERN (already sections-shaped) TrainingPlan — the completion's
        // owning session must be resolvable via the typed collection. ──────────────
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Plan",
            Status = TrainingPlanStatus.Active,
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-30),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Session",
                            Order = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = sectionAId,
                                    Order = 0,
                                    Name = "A",
                                    Exercises = [new SessionExercise { ExerciseExternalId = exerciseInA, ExerciseName = "Squat", Order = 1 }]
                                },
                                new TrainingSection
                                {
                                    SectionId = sectionBId,
                                    Order = 1,
                                    Name = "B",
                                    Exercises = [new SessionExercise { ExerciseExternalId = exerciseInB, ExerciseName = "Bench", Order = 1 }]
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // ── Seed a LEGACY TrainingCompletion — flat completedExerciseIds only, no
        // completedExerciseIdsBySection, and an orphan id no longer in the session. ─
        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");
        var completionId = Guid.NewGuid();
        var completionDate = DateTime.UtcNow.Date;

        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(clientId) },
            { "date", completionDate },
            { "sessionId", GuidBson(sessionId) },
            {
                "completedExerciseIds", new BsonArray
                {
                    GuidBson(exerciseInA), GuidBson(exerciseInB), GuidBson(orphanExerciseId)
                }
            },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-5) }
            // NOTE: no "completedExerciseIdsBySection" field.
        };
        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        // ── Compute the EXPECTED effective map directly (read-equivalence oracle) ───
        var completionForOracle = new TrainingCompletion
        {
            ExternalId = completionId,
            ClientId = clientId,
            Date = completionDate,
            SessionId = sessionId,
            CompletedExerciseIds = [exerciseInA, exerciseInB, orphanExerciseId],
            Version = 1
        };
        var expected = TrainingCompletionBackfill.GetEffectiveCompletedExerciseIdsBySection(
            completionForOracle, plan.Weeks[0].Sessions[0]);

        // ── Run the migration ───────────────────────────────────────────────────────
        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.CompletedExerciseIdsBySection.Should().NotBeNull(
            "the migration must populate the section-aware map for a resolvable session");

        var actual = migrated.CompletedExerciseIdsBySection!
            .ToDictionary(kvp => Guid.Parse(kvp.Key), kvp => kvp.Value.ToHashSet());

        actual.Keys.Should().BeEquivalentTo(expected.Keys);
        actual[sectionAId].Should().BeEquivalentTo(new[] { exerciseInA });
        actual[sectionBId].Should().BeEquivalentTo(new[] { exerciseInB });

        // The orphan exercise id (no longer present in any section of the resolved
        // session) must be dropped, matching the exact read-time attribution algorithm.
        actual.Values.SelectMany(v => v).Should().NotContain(orphanExerciseId);

        // The flat CompletedExerciseIds mirror must be preserved verbatim (not $unset) —
        // asymmetric retirement: it's demoted to a derived mirror, never destroyed.
        migrated.CompletedExerciseIds.Should().BeEquivalentTo([exerciseInA, exerciseInB, orphanExerciseId]);
    }

    // ── (5) TrainingCompletion — session no longer resolvable is handled gracefully ─

    [Fact]
    public async Task TrainingCompletion_SessionNotResolvable_LeavesBySectionNull_DoesNotThrow()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_orphan_session_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid(); // no TrainingPlan exists referencing this at all

        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");
        var completionId = Guid.NewGuid();

        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(clientId) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(sessionId) },
            { "completedExerciseIds", new BsonArray { GuidBson(Guid.NewGuid()) } },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-5) }
        };
        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer.StartAsync(ct);

        await act.Should().NotThrowAsync("an unresolvable session must be skipped, not throw");

        var migrated = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.CompletedExerciseIdsBySection.Should().BeNull(
            "no plan/session resolves for this completion — the map is left null rather than guessed at");
    }

    // ── (6) Idempotency — re-running the migration is a no-op ────────────────────

    [Fact]
    public async Task Migration_ReRun_IsIdempotent_NoOpOnSecondBoot()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("migration_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");
        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");
        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var legacyPlanDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(planId) },
            { "clientId", GuidBson(clientId) },
            { "trainerId", GuidBson(Guid.NewGuid()) },
            { "name", "Plan" },
            { "status", "Active" },
            { "version", 1 },
            { "dateCreated", DateTime.UtcNow.AddDays(-30) },
            {
                "weeks", new BsonArray
                {
                    new BsonDocument
                    {
                        { "weekNumber", 1 },
                        { "status", "Published" },
                        {
                            "sessions", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "sessionId", GuidBson(sessionId) },
                                    { "dayOfWeek", 1 },
                                    { "name", "Day" },
                                    { "order", 1 },
                                    {
                                        "exercises", new BsonArray
                                        {
                                            new BsonDocument
                                            {
                                                { "exerciseExternalId", GuidBson(exerciseId) },
                                                { "exerciseName", "Squat" },
                                                { "order", 1 },
                                                { "movementType", "Reps" },
                                                { "sets", new BsonArray { new BsonDocument { { "setNumber", 1 }, { "type", "Normal" } } } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        await rawPlans.InsertOneAsync(legacyPlanDoc, cancellationToken: ct);

        var logId = Guid.NewGuid();
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
                        { "exerciseExternalId", GuidBson(exerciseId) },
                        { "exerciseName", "Squat" },
                        { "sets", new BsonArray { new BsonDocument { { "setNumber", 1 }, { "isPR", false } } } }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddMinutes(-45) }
        };
        await rawLogs.InsertOneAsync(legacyLogDoc, cancellationToken: ct);

        var completionId = Guid.NewGuid();
        var legacyCompletionDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(completionId) },
            { "clientId", GuidBson(clientId) },
            { "date", DateTime.UtcNow.Date },
            { "sessionId", GuidBson(sessionId) },
            { "completedExerciseIds", new BsonArray { GuidBson(exerciseId) } },
            { "dateCreated", DateTime.UtcNow.AddDays(-5) }
        };
        await rawCompletions.InsertOneAsync(legacyCompletionDoc, cancellationToken: ct);

        // ── First run ────────────────────────────────────────────────────────────────
        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer1.StartAsync(ct);

        var planAfterFirstRun = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);
        var logAfterFirstRun = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);
        var completionAfterFirstRun = await rawCompletions.Find(new BsonDocument("externalId", GuidBson(completionId))).FirstOrDefaultAsync(ct);

        // ── Second run against the now-migrated data ────────────────────────────────
        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer2.StartAsync(ct);
        await act.Should().NotThrowAsync("re-running the migration on already-migrated data must be a safe no-op");

        var planAfterSecondRun = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);
        var logAfterSecondRun = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);
        var completionAfterSecondRun = await rawCompletions.Find(new BsonDocument("externalId", GuidBson(completionId))).FirstOrDefaultAsync(ct);

        // No duplicate synthetic sections, no re-attribution — documents are byte-identical
        // (BsonDocument.Equals is structural). Assert via Equals directly — BsonDocument
        // implements IEnumerable<BsonElement>, so FluentAssertions' Should() resolves to
        // collection assertions rather than object-equality assertions here.
        planAfterSecondRun!.Equals(planAfterFirstRun).Should().BeTrue(
            "re-running must not re-synthesize a second section or mutate the plan further");
        logAfterSecondRun!.Equals(logAfterFirstRun).Should().BeTrue(
            "re-running must not re-synthesize a second section or mutate the log further");
        completionAfterSecondRun!.Equals(completionAfterFirstRun).Should().BeTrue(
            "re-running must not re-attribute or touch an already-backfilled completion");
    }
}

// ── Minimal IMongoContext for migration tests ─────────────────────────────────────

/// <summary>
/// Minimal <see cref="IMongoContext"/> implementation for the #837 migration tests.
/// Only <see cref="TrainingPlans"/>, <see cref="WorkoutLogs"/>, and
/// <see cref="TrainingCompletions"/> are exercised directly by the tests; the remaining
/// collections point at the same database so <see cref="MongoIndexInitializer.StartAsync"/>'s
/// full index-creation pass (which touches every collection) succeeds harmlessly.
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
    public IMongoCollection<SectionTemplate> SectionTemplates => _db.GetCollection<SectionTemplate>("sectionTemplates");
    public IMongoCollection<SessionLock> SessionLocks => _db.GetCollection<SessionLock>("sessionLocks");
    public IMongoCollection<SessionLog> SessionLogs => _db.GetCollection<SessionLog>("sessionLogs");
    public IMongoCollection<TrainerNote> TrainerNotes => _db.GetCollection<TrainerNote>("trainer_notes");
    public IMongoCollection<WorkoutTemplate> WorkoutTemplates => _db.GetCollection<WorkoutTemplate>("workoutTemplates");
}
