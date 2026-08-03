using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) proving the #857 phase 3b boot migration that
/// resolves the retired <c>completedExerciseIdsBySection</c> dictionary (keyed by
/// <see cref="TrainingWorkout.WorkoutId"/>, valued with catalog
/// <see cref="SessionExercise.ExerciseExternalId"/> values) into the flat
/// <c>completedExerciseInstanceIds</c> list (<see cref="SessionExercise.ExerciseId"/> instance
/// values), on both <c>sessionExecutions</c> and <c>trainingCompletions</c>.
/// </summary>
/// <remarks>
/// Unlike every other #857 migration in this epic, a resolution failure here fails SILENTLY —
/// an unresolved completion simply reads back as "never completed" with no exception anywhere.
/// These tests are written around that risk specifically: <see cref="StartAsync_ZeroUnresolvedForSeededData"/>
/// asserts the migration's own unresolved counter is zero for well-formed data (the only way to
/// distinguish "resolved" from "silently dropped"), and
/// <see cref="StartAsync_SameCatalogExerciseStandaloneAndNested_ResolvesToTheCorrectInstance"/>
/// proves resolution picks the CORRECT occurrence, not merely AN occurrence, for the exact
/// ambiguity <see cref="SessionExercise.ExerciseId"/> exists to remove.
/// </remarks>
public class CompletionExerciseInstanceIdsMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    /// <summary>
    /// Builds a raw, pre-#857-phase-3b <c>sessionExecutions</c> document — carries the retired
    /// <c>completedExerciseIds</c>/<c>completedExerciseIdsBySection</c> fields, not
    /// <c>completedExerciseInstanceIds</c>. Seeding via raw BSON (not the C# model) is required:
    /// the C# model no longer has these properties, so constructing through it would silently
    /// write the NEW field names and prove nothing about the migration.
    /// </summary>
    private static BsonDocument BuildLegacySessionExecutionDoc(
        Guid externalId, Guid clientId, Guid planId, Guid sessionId, DateTime date,
        BsonDocument completedExerciseIdsBySection, BsonDocument? completedSets = null) => new()
    {
        { "_id", ObjectId.GenerateNewId() },
        { "externalId", GuidBson(externalId) },
        { "clientId", GuidBson(clientId) },
        { "planId", GuidBson(planId) },
        { "sessionId", GuidBson(sessionId) },
        { "date", date },
        { "status", "Partial" },
        { "completedExerciseIds", new BsonArray() },
        { "completedExerciseIdsBySection", completedExerciseIdsBySection },
        { "completedSets", completedSets ?? new BsonDocument() },
        { "dateCreated", DateTime.UtcNow.AddDays(-1) },
        { "version", 1 }
    };

    /// <summary>
    /// Builds a raw, pre-#857-phase-3b <c>trainingCompletions</c> document — same retired shape
    /// as <see cref="BuildLegacySessionExecutionDoc"/>.
    /// </summary>
    private static BsonDocument BuildLegacyTrainingCompletionDoc(
        Guid externalId, Guid clientId, Guid sessionId, DateTime date,
        BsonDocument completedExerciseIdsBySection) => new()
    {
        { "_id", ObjectId.GenerateNewId() },
        { "externalId", GuidBson(externalId) },
        { "clientId", GuidBson(clientId) },
        { "sessionId", GuidBson(sessionId) },
        { "date", date },
        { "completedExerciseIds", new BsonArray() },
        { "completedExerciseIdsBySection", completedExerciseIdsBySection },
        { "dateCreated", DateTime.UtcNow.AddDays(-1) },
        { "version", 1 }
    };

    /// <summary>
    /// Builds a raw, pre-#857-phase-3b <c>sessionExecutions</c> document carrying ONLY the older,
    /// dictionary-less flat <c>completedExerciseIds</c> field — no
    /// <c>completedExerciseIdsBySection</c> at all. This is the shape that predates the
    /// by-workout dictionary and that the original candidate filter (matching solely on
    /// <c>completedExerciseIdsBySection</c> existence) missed entirely, leaving
    /// <c>completedExerciseIds</c> on the document as an unmapped extra element for the next
    /// typed read to throw on.
    /// </summary>
    private static BsonDocument BuildFlatOnlyLegacySessionExecutionDoc(
        Guid externalId, Guid clientId, Guid planId, Guid sessionId, DateTime date,
        BsonArray completedExerciseIds) => new()
    {
        { "_id", ObjectId.GenerateNewId() },
        { "externalId", GuidBson(externalId) },
        { "clientId", GuidBson(clientId) },
        { "planId", GuidBson(planId) },
        { "sessionId", GuidBson(sessionId) },
        { "date", date },
        { "status", "Partial" },
        { "completedExerciseIds", completedExerciseIds },
        { "dateCreated", DateTime.UtcNow.AddDays(-1) },
        { "version", 1 }
    };

    /// <summary>
    /// Builds a training plan (already in the current #857-phase-3a shape — days materialised,
    /// ExerciseId assigned) with a single week/day/session containing one workout and,
    /// optionally, one standalone exercise sharing the same catalog external id as the workout's
    /// exercise.
    /// </summary>
    private static TrainingPlan BuildPlan(
        Guid planId, Guid clientId, Guid sessionId, Guid workoutId,
        Guid workoutExerciseInstanceId, Guid sharedExternalId,
        Guid? standaloneExerciseInstanceId, DateTime startDate)
    {
        var workoutExercise = new SessionExercise
        {
            ExerciseId = workoutExerciseInstanceId,
            ExerciseExternalId = sharedExternalId,
            ExerciseName = "Push-up",
            Order = 1
        };

        var session = new TrainingSession
        {
            SessionId = sessionId,
            Name = "Mixed Day",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutId,
                    Order = 0,
                    Name = "Hlavni",
                    Exercises = [workoutExercise]
                }
            ]
        };

        if (standaloneExerciseInstanceId.HasValue)
        {
            session.StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneExerciseInstanceId.Value,
                    ExerciseExternalId = sharedExternalId,
                    ExerciseName = "Push-up",
                    Order = 2
                }
            ];
        }

        var days = Enumerable.Range(1, 7)
            .Select(dayOfWeek => new TrainingDay
            {
                DayOfWeek = dayOfWeek,
                Sessions = dayOfWeek == 1 ? [session] : []
            })
            .ToList();

        return new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "QA completion resolution fixture",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate.AddDays(-1),
                    Days = days
                }
            ],
            DateCreated = startDate.AddDays(-7)
        };
    }

    [Fact]
    public async Task StartAsync_SameCatalogExerciseStandaloneAndNested_ResolvesToTheCorrectInstance()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_duplicate_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var sharedExternalId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc); // a Monday

        var plan = BuildPlan(planId, clientId, sessionId, workoutId, nestedInstanceId, sharedExternalId,
            standaloneInstanceId, startDate);
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // completedExerciseIdsBySection scopes the completion to the WORKOUT only — this is the
        // exact ambiguity that motivated ExerciseId: the same catalog exercise (sharedExternalId)
        // also sits standalone on the session, unreachable in pre-857 data since no standalone
        // field existed then.
        var bySection = new BsonDocument
        {
            { workoutId.ToString(), new BsonArray { GuidBson(sharedExternalId) } }
        };

        var executionExternalId = Guid.NewGuid();
        var executionDoc = BuildLegacySessionExecutionDoc(
            executionExternalId, clientId, planId, sessionId, startDate, bySection);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(executionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var unresolvedCount = await initializer.MigrateCompletionExerciseInstanceIdsAsync(ct);

        unresolvedCount.Should().Be(0);

        var migrated = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionExternalId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.CompletedExerciseInstanceIds.Should().ContainSingle()
            .Which.Should().Be(nestedInstanceId,
                "the completion was recorded against the WORKOUT (via completedExerciseIdsBySection's " +
                "workoutId key), so it must resolve to the nested instance, not the standalone one that " +
                "happens to share the same catalog ExerciseExternalId");
        migrated.CompletedExerciseInstanceIds.Should().NotContain(standaloneInstanceId,
            "resolving against the session's flat exercise view instead of the named workout would " +
            "wrongly pick up the standalone instance first");
    }

    [Fact]
    public async Task StartAsync_ZeroUnresolvedForSeededData()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_unresolved_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var externalId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var plan = BuildPlan(planId, clientId, sessionId, workoutId, instanceId, externalId, null, startDate);
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        var bySection = new BsonDocument
        {
            { workoutId.ToString(), new BsonArray { GuidBson(externalId) } }
        };
        var completedSets = new BsonDocument { { externalId.ToString(), new BsonArray { 1, 2, 3 } } };

        var executionExternalId = Guid.NewGuid();
        var executionDoc = BuildLegacySessionExecutionDoc(
            executionExternalId, clientId, planId, sessionId, startDate, bySection, completedSets);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(executionDoc, cancellationToken: ct);

        var completionExternalId = Guid.NewGuid();
        var completionDoc = BuildLegacyTrainingCompletionDoc(
            completionExternalId, clientId, sessionId, startDate, bySection);

        var rawCompletions = db.GetCollection<BsonDocument>("trainingCompletions");
        await rawCompletions.InsertOneAsync(completionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var unresolvedCount = await initializer.MigrateCompletionExerciseInstanceIdsAsync(ct);

        unresolvedCount.Should().Be(0,
            "every completion entry seeded here references a workout/exercise that genuinely " +
            "exists in the plan, so none of them should be silently dropped");

        var migratedExecution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionExternalId))
            .FirstOrDefaultAsync(ct);
        migratedExecution!.CompletedExerciseInstanceIds.Should().Equal([instanceId]);
        migratedExecution.CompletedSets.Should().ContainKey(instanceId.ToString());
        migratedExecution.CompletedSets![instanceId.ToString()].Should().Equal([1, 2, 3]);

        var migratedCompletion = await mongo.TrainingCompletions
            .Find(Builders<TrainingCompletion>.Filter.Eq(c => c.ExternalId, completionExternalId))
            .FirstOrDefaultAsync(ct);
        migratedCompletion!.CompletedExerciseInstanceIds.Should().Equal([instanceId]);
    }

    [Fact]
    public async Task StartAsync_UnresolvableCompletion_IsCountedNotThrown()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_unresolvable_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var realExternalId = Guid.NewGuid();
        var realInstanceId = Guid.NewGuid();
        var goneExternalId = Guid.NewGuid(); // no longer present in the plan's workout
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var plan = BuildPlan(planId, clientId, sessionId, workoutId, realInstanceId, realExternalId, null, startDate);
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // References an exercise (goneExternalId) that has since been removed from the workout.
        var bySection = new BsonDocument
        {
            { workoutId.ToString(), new BsonArray { GuidBson(realExternalId), GuidBson(goneExternalId) } }
        };

        var executionExternalId = Guid.NewGuid();
        var executionDoc = BuildLegacySessionExecutionDoc(
            executionExternalId, clientId, planId, sessionId, startDate, bySection);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(executionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);

        // A genuine deserialization/resolution exception would fail this await directly —
        // asserting the returned count (rather than swallowing it) is what proves the
        // unresolvable entry was COUNTED rather than silently ignored.
        var unresolvedCount = await initializer.MigrateCompletionExerciseInstanceIdsAsync(ct);

        unresolvedCount.Should().Be(1,
            "goneExternalId no longer matches any exercise in the workout and must be counted as " +
            "unresolved rather than silently dropped with no trace");

        var migrated = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionExternalId))
            .FirstOrDefaultAsync(ct);
        migrated!.CompletedExerciseInstanceIds.Should().Equal([realInstanceId],
            "the resolvable entry still migrates even though its sibling in the same section is unresolvable");
    }

    [Fact]
    public async Task StartAsync_FlatFieldOnlyNoBySectionDictionary_ResolvesAndReadsBackWithoutThrowing()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_flat_only_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var externalId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var plan = BuildPlan(planId, clientId, sessionId, workoutId, instanceId, externalId, null, startDate);
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // Carries ONLY the older, dictionary-less flat field — no completedExerciseIdsBySection
        // at all. This is the exact production shape the original candidate filter (matching
        // solely on completedExerciseIdsBySection existence) missed, leaving completedExerciseIds
        // behind as an unmapped extra element that threw BsonSerializationException on the next
        // typed read.
        var executionExternalId = Guid.NewGuid();
        var executionDoc = BuildFlatOnlyLegacySessionExecutionDoc(
            executionExternalId, clientId, planId, sessionId, startDate, new BsonArray { GuidBson(externalId) });

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(executionDoc, cancellationToken: ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);

        // A genuine BsonSerializationException on the missed field would fail this await (or the
        // typed read below) directly.
        var unresolvedCount = await initializer.MigrateCompletionExerciseInstanceIdsAsync(ct);

        unresolvedCount.Should().Be(0,
            "externalId appears exactly once in the plan's session, so it is unambiguous and must resolve");

        var rawAfter = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionExternalId)))
            .FirstOrDefaultAsync(ct);
        rawAfter.Contains("completedExerciseIds").Should().BeFalse(
            "the retired flat field must be dropped even when it was never accompanied by " +
            "completedExerciseIdsBySection");
        rawAfter.Contains("completedExerciseIdsBySection").Should().BeFalse();
        rawAfter.Contains("completedExerciseInstanceIds").Should().BeTrue();

        // The typed read is the real regression check: pre-fix, this document was never migrated
        // (the candidate filter didn't match it), so completedExerciseIds survived as an unmapped
        // extra element and this Find/FirstOrDefaultAsync threw BsonSerializationException.
        var migrated = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, executionExternalId))
            .FirstOrDefaultAsync(ct);

        migrated.Should().NotBeNull();
        migrated!.CompletedExerciseInstanceIds.Should().Equal([instanceId]);
    }

    [Fact]
    public async Task StartAsync_SecondBoot_IsIdempotent()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_idempotency_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var externalId = Guid.NewGuid();
        var instanceId = Guid.NewGuid();
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var plan = BuildPlan(planId, clientId, sessionId, workoutId, instanceId, externalId, null, startDate);
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        var bySection = new BsonDocument { { workoutId.ToString(), new BsonArray { GuidBson(externalId) } } };
        var executionExternalId = Guid.NewGuid();
        var executionDoc = BuildLegacySessionExecutionDoc(
            executionExternalId, clientId, planId, sessionId, startDate, bySection);

        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(executionDoc, cancellationToken: ct);

        var initializer1 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var firstUnresolved = await initializer1.MigrateCompletionExerciseInstanceIdsAsync(ct);
        firstUnresolved.Should().Be(0);

        var afterFirstRun = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionExternalId)))
            .FirstOrDefaultAsync(ct);
        afterFirstRun.Contains("completedExerciseIdsBySection").Should().BeFalse();
        afterFirstRun.Contains("completedExerciseIds").Should().BeFalse();
        afterFirstRun.Contains("completedExerciseInstanceIds").Should().BeTrue();

        var initializer2 = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var secondUnresolved = await initializer2.MigrateCompletionExerciseInstanceIdsAsync(ct);
        secondUnresolved.Should().Be(0, "a second boot against an already-migrated document must be a clean no-op");

        var afterSecondRun = await rawExecutions
            .Find(new BsonDocument("externalId", GuidBson(executionExternalId)))
            .FirstOrDefaultAsync(ct);
        afterSecondRun!.Equals(afterFirstRun).Should().BeTrue(
            "a second boot must not rewrite an already-migrated document");
    }

    [Fact]
    public async Task StartAsync_ComplianceFigures_MatchPreMigrationCompleteness()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("completion_instance_ids_compliance_test");
        var mongo = new MigrationTestMongoContext(db);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var startDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc); // Monday, week 1 day 1

        // Two sessions on the same day: session A fully completed under the OLD (pre-migration)
        // section-dict semantics, session B only partially. The pre-migration expectation below
        // is derived directly from the seeded data's OWN intent (not from invoking
        // ComplianceService, which cannot read the legacy raw shape once the C# model has
        // dropped the retired fields — that IS the point of this migration).
        var sessionAId = Guid.NewGuid();
        var workoutAId = Guid.NewGuid();
        var exerciseAExternalId = Guid.NewGuid();
        var exerciseAInstanceId = Guid.NewGuid();

        var sessionBId = Guid.NewGuid();
        var workoutBId = Guid.NewGuid();
        var exerciseBExternalId = Guid.NewGuid();
        var exerciseBInstanceId = Guid.NewGuid();

        var sessionA = new TrainingSession
        {
            SessionId = sessionAId,
            Name = "Session A",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutAId,
                    Order = 0,
                    Name = "Hlavni",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = exerciseAInstanceId,
                            ExerciseExternalId = exerciseAExternalId,
                            ExerciseName = "Squat",
                            Order = 1
                        }
                    ]
                }
            ]
        };

        var sessionB = new TrainingSession
        {
            SessionId = sessionBId,
            Name = "Session B",
            Order = 2,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutBId,
                    Order = 0,
                    Name = "Hlavni",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = exerciseBInstanceId,
                            ExerciseExternalId = exerciseBExternalId,
                            ExerciseName = "Bench",
                            Order = 1
                        }
                    ]
                }
            ]
        };

        var days = Enumerable.Range(1, 7)
            .Select(dayOfWeek => new TrainingDay
            {
                DayOfWeek = dayOfWeek,
                Sessions = dayOfWeek == 1 ? [sessionA, sessionB] : []
            })
            .ToList();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "QA compliance-preservation fixture",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate.AddDays(-1),
                    Days = days
                }
            ],
            DateCreated = startDate.AddDays(-7)
        };
        await mongo.TrainingPlans.InsertOneAsync(plan, cancellationToken: ct);

        // Session A: completedExerciseIdsBySection covers its ONLY exercise -> fully complete.
        var bySectionA = new BsonDocument { { workoutAId.ToString(), new BsonArray { GuidBson(exerciseAExternalId) } } };
        var rawExecutions = db.GetCollection<BsonDocument>("sessionExecutions");
        await rawExecutions.InsertOneAsync(
            BuildLegacySessionExecutionDoc(Guid.NewGuid(), clientId, planId, sessionAId, startDate, bySectionA),
            cancellationToken: ct);

        // Session B: completedExerciseIdsBySection is present but EMPTY -> not complete.
        var bySectionB = new BsonDocument();
        await rawExecutions.InsertOneAsync(
            BuildLegacySessionExecutionDoc(Guid.NewGuid(), clientId, planId, sessionBId, startDate, bySectionB),
            cancellationToken: ct);

        // ── Pre-migration expectation (derived from the seed data's own intent, not from
        // ComplianceService — see class remarks): 1 of 2 planned sessions complete = 50%.
        const decimal expectedTrainingCompliancePercent = 50.0m;
        const int expectedTrainingsPlanned = 2;
        const int expectedTrainingsCompleted = 1;

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var unresolvedCount = await initializer.MigrateCompletionExerciseInstanceIdsAsync(ct);
        unresolvedCount.Should().Be(0);

        var complianceService = new ComplianceService(mongo);
        var result = await complianceService.CalculateComplianceAsync(clientId, startDate, startDate, ct);

        result.TrainingsPlanned.Should().Be(expectedTrainingsPlanned);
        result.TrainingsCompleted.Should().Be(expectedTrainingsCompleted,
            "the migration must preserve exactly which sessions were complete under the retired " +
            "section-dict model — a resolution bug here would silently skew compliance");
        result.TrainingCompliancePercent.Should().Be(expectedTrainingCompliancePercent);
    }
}
