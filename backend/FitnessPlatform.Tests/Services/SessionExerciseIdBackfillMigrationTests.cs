using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) proving the #857 phase 3a boot migration that
/// backfills <see cref="SessionExercise.ExerciseId"/> — an additive instance-identity field, not a
/// rename — onto every pre-existing exercise in a <c>trainingPlans</c> document. Covers exercises
/// nested inside a workout, standalone exercises directly on a session, distinctness for two
/// instances of the same catalog exercise (the entire point of the field), and idempotency across
/// a second boot.
/// </summary>
public class SessionExerciseIdBackfillMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    /// <summary>
    /// Builds a raw (already-restructured to the #857 phase 2 "days" shape) <c>trainingPlans</c>
    /// document with the given raw week documents, none of whose exercises carry "exerciseId" —
    /// the pre-#857-phase-3a on-disk shape.
    /// </summary>
    private static BsonDocument BuildPlanDoc(Guid planId, BsonArray weeks) => new()
    {
        { "_id", ObjectId.GenerateNewId() },
        { "externalId", GuidBson(planId) },
        { "clientId", GuidBson(Guid.NewGuid()) },
        { "trainerId", GuidBson(Guid.NewGuid()) },
        { "name", "QA exerciseId backfill fixture" },
        { "status", "Active" },
        { "weeks", weeks },
        { "version", 1 },
        { "dateCreated", DateTime.UtcNow.AddDays(-1) }
    };

    private static BsonDocument BuildDayDoc(int dayOfWeek, BsonArray sessions) => new()
    {
        { "dayOfWeek", dayOfWeek },
        { "sessions", sessions }
    };

    private static BsonDocument BuildWeekDoc(int weekNumber, BsonArray days) => new()
    {
        { "weekNumber", weekNumber },
        { "status", "Draft" },
        { "days", days }
    };

    /// <summary>
    /// Builds a session with no standalone exercises and a single workout carrying
    /// <paramref name="workoutExercises"/> — none of which carry "exerciseId".
    /// </summary>
    private static BsonDocument BuildSessionWithWorkout(Guid sessionId, Guid workoutId, BsonArray workoutExercises) => new()
    {
        { "sessionId", GuidBson(sessionId) },
        { "name", "Push Day" },
        { "order", 1 },
        {
            "workouts", new BsonArray
            {
                new BsonDocument
                {
                    { "workoutId", GuidBson(workoutId) },
                    { "order", 0 },
                    { "name", "Hlavní" },
                    { "exercises", workoutExercises }
                }
            }
        }
    };

    private static BsonDocument BuildExerciseDoc(Guid exerciseExternalId, string name, int order) => new()
    {
        { "exerciseExternalId", GuidBson(exerciseExternalId) },
        { "exerciseName", name },
        { "order", order },
        { "movementType", "Reps" },
        { "sets", new BsonArray() }
    };

    [Fact]
    public async Task StartAsync_ExercisesNestedInWorkout_AssignsDistinctExerciseIds()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("session_exercise_id_backfill_nested_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var squatExternalId = Guid.NewGuid();
        var benchExternalId = Guid.NewGuid();

        var workoutExercises = new BsonArray
        {
            BuildExerciseDoc(squatExternalId, "Squat", 1),
            BuildExerciseDoc(benchExternalId, "Bench Press", 2)
        };

        var session = BuildSessionWithWorkout(sessionId, workoutId, workoutExercises);
        var days = new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
            BuildDayDoc(dayOfWeek, dayOfWeek == 1 ? new BsonArray { session } : new BsonArray())));
        var week = BuildWeekDoc(1, days);
        var planDoc = BuildPlanDoc(planId, new BsonArray { week });

        await rawPlans.InsertOneAsync(planDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        var migratedSession = migrated!.Weeks[0].Days.Single(d => d.DayOfWeek == 1).Sessions.Single(s => s.SessionId == sessionId);
        var workoutExercisesAfter = migratedSession.Workouts.Single(w => w.WorkoutId == workoutId).Exercises;

        workoutExercisesAfter.Should().HaveCount(2);
        workoutExercisesAfter.Should().OnlyContain(e => e.ExerciseId != Guid.Empty);
        workoutExercisesAfter.Select(e => e.ExerciseId).Should().OnlyHaveUniqueItems(
            "every exercise instance must get a distinct id even though these are different catalog exercises");
    }

    [Fact]
    public async Task StartAsync_StandaloneExercisesOnSession_AssignsDistinctExerciseIds()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("session_exercise_id_backfill_standalone_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var finisherExternalId = Guid.NewGuid();

        // A session with a standalone exercise directly on it and no workouts at all — the shape
        // #857 phase 3a newly allows.
        var session = new BsonDocument
        {
            { "sessionId", GuidBson(sessionId) },
            { "name", "Finisher Day" },
            { "order", 1 },
            { "workouts", new BsonArray() },
            { "exercises", new BsonArray { BuildExerciseDoc(finisherExternalId, "Burpee", 1) } }
        };

        var days = new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
            BuildDayDoc(dayOfWeek, dayOfWeek == 3 ? new BsonArray { session } : new BsonArray())));
        var week = BuildWeekDoc(1, days);
        var planDoc = BuildPlanDoc(planId, new BsonArray { week });

        await rawPlans.InsertOneAsync(planDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        var migratedSession = migrated!.Weeks[0].Days.Single(d => d.DayOfWeek == 3).Sessions.Single(s => s.SessionId == sessionId);

        migratedSession.StandaloneExercises.Should().ContainSingle();
        migratedSession.StandaloneExercises[0].ExerciseId.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task StartAsync_SameCatalogExerciseStandaloneAndNestedInSameSession_GetsDistinctInstanceIds()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("session_exercise_id_backfill_duplicate_catalog_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        // Same catalog exercise programmed BOTH standalone on the session AND nested in a
        // workout of that same session — unreachable in pre-857 data (no standalone field
        // existed), so this is the exact ambiguity ExerciseId exists to resolve.
        var sharedCatalogExerciseId = Guid.NewGuid();

        var session = new BsonDocument
        {
            { "sessionId", GuidBson(sessionId) },
            { "name", "Mixed Day" },
            { "order", 1 },
            {
                "workouts", new BsonArray
                {
                    new BsonDocument
                    {
                        { "workoutId", GuidBson(workoutId) },
                        { "order", 0 },
                        { "name", "Hlavní" },
                        { "exercises", new BsonArray { BuildExerciseDoc(sharedCatalogExerciseId, "Push-up", 1) } }
                    }
                }
            },
            { "exercises", new BsonArray { BuildExerciseDoc(sharedCatalogExerciseId, "Push-up", 1) } }
        };

        var days = new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
            BuildDayDoc(dayOfWeek, dayOfWeek == 1 ? new BsonArray { session } : new BsonArray())));
        var week = BuildWeekDoc(1, days);
        var planDoc = BuildPlanDoc(planId, new BsonArray { week });

        await rawPlans.InsertOneAsync(planDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);

        var migratedSession = migrated!.Weeks[0].Days.Single(d => d.DayOfWeek == 1).Sessions.Single(s => s.SessionId == sessionId);
        var standaloneId = migratedSession.StandaloneExercises.Single().ExerciseId;
        var nestedId = migratedSession.Workouts.Single().Exercises.Single().ExerciseId;

        standaloneId.Should().NotBe(Guid.Empty);
        nestedId.Should().NotBe(Guid.Empty);
        standaloneId.Should().NotBe(nestedId,
            "assigning one id per CATALOG exercise instead of per INSTANCE would defeat the entire " +
            "point of ExerciseId — these two entries share the same ExerciseExternalId but must " +
            "still get distinct instance ids");
    }

    [Fact]
    public async Task StartAsync_SecondBoot_IsIdempotent_ExerciseIdsStableAndNoDocumentsRewritten()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("session_exercise_id_backfill_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var exerciseExternalId = Guid.NewGuid();

        var session = BuildSessionWithWorkout(sessionId, workoutId,
            new BsonArray { BuildExerciseDoc(exerciseExternalId, "Deadlift", 1) });
        var days = new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
            BuildDayDoc(dayOfWeek, dayOfWeek == 2 ? new BsonArray { session } : new BsonArray())));
        var week = BuildWeekDoc(1, days);
        var planDoc = BuildPlanDoc(planId, new BsonArray { week });

        await rawPlans.InsertOneAsync(planDoc, cancellationToken: ct);

        // ── First boot: assigns exerciseId ────────────────────────────────────────────
        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer1.StartAsync(ct);

        var rawAfterFirstBoot = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);

        var migratedFirst = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        var assignedId = migratedFirst!.Weeks[0].Days.Single(d => d.DayOfWeek == 2).Sessions.Single(s => s.SessionId == sessionId)
            .Workouts.Single().Exercises.Single().ExerciseId;
        assignedId.Should().NotBe(Guid.Empty);

        // ── Second boot: must be a no-op — same document, same exerciseId ─────────────
        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer2.StartAsync(ct);
        await act.Should().NotThrowAsync("re-running the migration on an already-backfilled document must be safe");

        var rawAfterSecondBoot = await rawPlans
            .Find(new BsonDocument("externalId", GuidBson(planId)))
            .FirstOrDefaultAsync(ct);

        rawAfterSecondBoot!.Equals(rawAfterFirstBoot).Should().BeTrue(
            "a second boot must mutate 0 documents — the already-backfilled document is untouched");

        var migratedSecond = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        var idAfterSecondBoot = migratedSecond!.Weeks[0].Days.Single(d => d.DayOfWeek == 2).Sessions.Single(s => s.SessionId == sessionId)
            .Workouts.Single().Exercises.Single().ExerciseId;

        idAfterSecondBoot.Should().Be(assignedId, "ExerciseId must be stable across repeat boots, not re-minted");
    }

    [Fact]
    public async Task StartAsync_DocumentAlreadyCarryingExerciseIds_IsLeftUntouched()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("session_exercise_id_backfill_already_migrated_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawPlans = db.GetCollection<BsonDocument>("trainingPlans");

        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var exerciseExternalId = Guid.NewGuid();
        var existingExerciseId = Guid.NewGuid();

        var exerciseDoc = BuildExerciseDoc(exerciseExternalId, "Overhead Press", 1);
        exerciseDoc["exerciseId"] = GuidBson(existingExerciseId);

        var session = BuildSessionWithWorkout(sessionId, workoutId, new BsonArray { exerciseDoc });
        var days = new BsonArray(Enumerable.Range(1, 7).Select(dayOfWeek =>
            BuildDayDoc(dayOfWeek, dayOfWeek == 4 ? new BsonArray { session } : new BsonArray())));
        var week = BuildWeekDoc(1, days);
        var planDoc = BuildPlanDoc(planId, new BsonArray { week });

        await rawPlans.InsertOneAsync(planDoc, cancellationToken: ct);

        var beforeBoot = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        await initializer.StartAsync(ct);

        var afterBoot = await rawPlans.Find(new BsonDocument("externalId", GuidBson(planId))).FirstOrDefaultAsync(ct);

        afterBoot!.Equals(beforeBoot).Should().BeTrue(
            "a document where every exercise already carries exerciseId must be left byte-for-byte untouched");

        var migrated = await mongo.TrainingPlans
            .Find(Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, planId))
            .FirstOrDefaultAsync(ct);
        migrated!.Weeks[0].Days.Single(d => d.DayOfWeek == 4).Sessions.Single(s => s.SessionId == sessionId)
            .Workouts.Single().Exercises.Single().ExerciseId.Should().Be(existingExerciseId);
    }
}
