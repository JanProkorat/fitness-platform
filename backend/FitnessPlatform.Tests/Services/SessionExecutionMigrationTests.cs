using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) for the #841 merge-WorkoutLog-and-
/// TrainingCompletion-into-SessionExecution boot migration:
/// <see cref="MongoIndexInitializer.MigrateSessionExecutionsAsync"/>.
/// </summary>
/// <remarks>
/// <para>
/// Uses a dedicated, per-test <see cref="MongoDbBuilder"/> container, reusing the shared
/// <see cref="MigrationTestMongoContext"/>, rather than the shared
/// <see cref="FitnessPlatform.Tests.Infrastructure.FitnessApiFactory"/> used
/// by <see cref="ClientIdStandardizationMigrationTests"/>. Unlike the #840 clientId-standardisation
/// migration (which only rewrites the key field on documents already matched by a caller-supplied
/// PublicId→UserId map), <c>MigrateSessionExecutionsAsync</c> unconditionally scans EVERY
/// <c>WorkoutLog</c> and <c>TrainingCompletion</c> document with <c>Filter.Empty</c> and INSERTS new
/// documents into a different collection. Running it against the shared, suite-wide Mongo container
/// (57 other test classes populate that collection across the full run) would migrate every other
/// test class's leftover fixtures too, making the exact merge/skip counts asserted below unreliable.
/// A fresh container per test keeps the counts exact and the tests independent of suite ordering.
/// </para>
/// <para>
/// This migration needs no PostgreSQL — it is pure Mongo-to-Mongo (see the
/// <c>--migrate-session-executions</c> remarks in <c>Program.cs</c>) — so the dedicated-container
/// approach also avoids spinning up the full <c>FitnessApiFactory</c> host for no benefit.
/// </para>
/// </remarks>
public class SessionExecutionMigrationTests
{
    private static async Task<(MongoDbContainer Container, MigrationTestMongoContext Mongo)> CreateMongoAsync(
        string dbName, CancellationToken ct)
    {
        var container = new MongoDbBuilder("mongo:7").Build();
        await container.StartAsync(ct);
        var client = new MongoClient(container.GetConnectionString());
        var db = client.GetDatabase(dbName);
        return (container, new MigrationTestMongoContext(db));
    }

    private static MongoIndexInitializer CreateInitializer(MigrationTestMongoContext mongo) =>
        new(mongo, NullLogger<MongoIndexInitializer>.Instance);

    // ── Fixture builders ──────────────────────────────────────────────────────────

    private static WorkoutLog BuildLog(
        Guid clientId, Guid? planId, Guid? sessionId, DateTime date, bool isCompleted, Guid exerciseId)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            PlanId = planId,
            SessionId = sessionId,
            StartedAt = date.AddHours(8),
            CompletedAt = isCompleted ? date.AddHours(9) : null,
            IsCompleted = isCompleted,
            CompletedDate = isCompleted ? date : null,
            Mood = 4,
            Notes = "Felt good",
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new WorkoutSet
                                {
                                    SetNumber = 1,
                                    Reps = 5,
                                    WeightKg = 100,
                                    CompletedAt = date.AddHours(9)
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = date.AddHours(7),
            DateUpdated = date.AddHours(9)
        };
    }

    private static TrainingCompletion BuildCompletion(Guid clientId, Guid sessionId, DateTime date, Guid exerciseId)
    {
        var sectionKey = Guid.NewGuid().ToString();
        return new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            SessionId = sessionId,
            Date = date,
            CompletedExerciseIds = [exerciseId],
            CompletedExerciseIdsBySection = new Dictionary<string, List<Guid>> { [sectionKey] = [exerciseId] },
            Version = 1,
            DateCreated = date.AddHours(6),
            DateUpdated = date.AddHours(6)
        };
    }

    // ── (1) MIGRATION MERGE — WorkoutLog + TrainingCompletion at the same key ────────

    [Fact]
    public async Task MigrateSessionExecutionsAsync_LogAndCompletionSameKey_MergesIntoSingleExecution()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_merge_test", ct);
        await using var containerDisposable = container;

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var log = BuildLog(clientId, planId, sessionId, date, isCompleted: true, exerciseId);
        var completion = BuildCompletion(clientId, sessionId, date, exerciseId);

        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);
        await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);

        var initializer = CreateInitializer(mongo);
        var (merged, logOnly, completionOnly, adHoc, skipped) = await initializer.MigrateSessionExecutionsAsync(ct);

        merged.Should().Be(1);
        logOnly.Should().Be(0);
        completionOnly.Should().Be(0);
        adHoc.Should().Be(0);
        skipped.Should().Be(0);

        var executions = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Empty).ToListAsync(ct);
        executions.Should().HaveCount(1, "exactly one SessionExecution must result from merging the pair");

        var execution = executions.Single();
        execution.ExternalId.Should().Be(log.ExternalId,
            "the merged document must carry the source WorkoutLog's ExternalId so PersonalRecord.WorkoutLogId keeps resolving");
        execution.ClientId.Should().Be(clientId);
        execution.PlanId.Should().Be(planId);
        execution.SessionId.Should().Be(sessionId);
        execution.Date.Should().Be(date);

        execution.Performance.Should().NotBeNull("the merge must carry the WorkoutLog's set-by-set performance data over");
        execution.Performance!.Workouts.Should().HaveCount(1);
        execution.Performance.Workouts[0].Exercises.Single().ExerciseExternalId.Should().Be(exerciseId);

        execution.CompletedExerciseIds.Should().BeEquivalentTo(completion.CompletedExerciseIds,
            "the merge must carry the TrainingCompletion's completion flags over");
        execution.CompletedExerciseIdsBySection.Should().BeEquivalentTo(completion.CompletedExerciseIdsBySection);

        execution.Status.Should().Be(SessionExecutionStatus.Completed,
            "log.IsCompleted=true means the finished live workout implies the session is done");
    }

    // ── (2a) ONLY-ONE-EXISTS — WorkoutLog only ───────────────────────────────────────

    [Fact]
    public async Task MigrateSessionExecutionsAsync_LogOnly_ProducesExecutionWithPerformanceAndNoCompletionFlags()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_logonly_test", ct);
        await using var containerDisposable = container;

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        // In-progress log (not yet completed) — no plan seeded, so the session can't be
        // resolved and Status must fall back to log.IsCompleted (false) => Partial.
        var log = BuildLog(clientId, planId, sessionId, date, isCompleted: false, exerciseId);
        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);

        var initializer = CreateInitializer(mongo);
        var (merged, logOnly, completionOnly, adHoc, skipped) = await initializer.MigrateSessionExecutionsAsync(ct);

        merged.Should().Be(0);
        logOnly.Should().Be(1);
        completionOnly.Should().Be(0);
        adHoc.Should().Be(0);
        skipped.Should().Be(0);

        var execution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, log.ExternalId))
            .FirstOrDefaultAsync(ct);

        execution.Should().NotBeNull();
        execution!.Performance.Should().NotBeNull("a log-only migration must still carry the performance data");
        execution.Performance!.Workouts.Should().HaveCount(1);
        execution.CompletedExerciseIds.Should().BeEmpty("no TrainingCompletion existed at this key — no completion flags to carry over");
        execution.CompletedExerciseIdsBySection.Should().BeNull();
        execution.Status.Should().Be(SessionExecutionStatus.Partial, "the log is not completed and no plan/session resolved");
    }

    // ── (2b) ONLY-ONE-EXISTS — TrainingCompletion only ───────────────────────────────

    [Fact]
    public async Task MigrateSessionExecutionsAsync_CompletionOnly_ProducesExecutionWithFlagsAndNoPerformance()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_completiononly_test", ct);
        await using var containerDisposable = container;

        var clientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var completion = BuildCompletion(clientId, sessionId, date, exerciseId);
        await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);

        var initializer = CreateInitializer(mongo);
        var (merged, logOnly, completionOnly, adHoc, skipped) = await initializer.MigrateSessionExecutionsAsync(ct);

        merged.Should().Be(0);
        logOnly.Should().Be(0);
        completionOnly.Should().Be(1);
        adHoc.Should().Be(0);
        skipped.Should().Be(0);

        var execution = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
                & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionId)
                & Builders<SessionExecution>.Filter.Eq(e => e.Date, date))
            .FirstOrDefaultAsync(ct);

        execution.Should().NotBeNull();
        // Completion-only keys have no source WorkoutLog (hence no PersonalRecord could
        // reference them), so a fresh ExternalId is generated rather than reusing the
        // completion's own ExternalId.
        execution!.ExternalId.Should().NotBe(completion.ExternalId);
        execution.Performance.Should().BeNull("no WorkoutLog existed at this key — there is no performance data to carry over");
        execution.CompletedExerciseIds.Should().BeEquivalentTo(completion.CompletedExerciseIds);
        execution.CompletedExerciseIdsBySection.Should().BeEquivalentTo(completion.CompletedExerciseIdsBySection);
        execution.Status.Should().Be(SessionExecutionStatus.Partial, "no plan/session resolved to evaluate full completeness");
    }

    // ── (3) IDEMPOTENCY — a second run mutates 0 documents ───────────────────────────

    [Fact]
    public async Task MigrateSessionExecutionsAsync_SecondRun_MutatesZeroDocuments()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_idempotency_test", ct);
        await using var containerDisposable = container;

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var log = BuildLog(clientId, planId, sessionId, date, isCompleted: true, exerciseId);
        var completion = BuildCompletion(clientId, sessionId, date, exerciseId);
        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);
        await mongo.TrainingCompletions.InsertOneAsync(completion, cancellationToken: ct);

        var initializer1 = CreateInitializer(mongo);
        var firstRun = await initializer1.MigrateSessionExecutionsAsync(ct);
        firstRun.Merged.Should().Be(1);
        firstRun.Skipped.Should().Be(0);

        var afterFirstRun = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, log.ExternalId))
            .FirstOrDefaultAsync(ct);
        afterFirstRun.Should().NotBeNull();

        // Second run — a fresh initializer instance, mirroring a re-run of the CLI command.
        // Capture the returned tuple via closure while still asserting via the idiomatic
        // NotThrowAsync (matches the sibling boot-migration tests in this folder).
        (long Merged, long LogOnly, long CompletionOnly, long AdHoc, long Skipped) secondRun = default;
        var initializer2 = CreateInitializer(mongo);
        var act = async () => { secondRun = await initializer2.MigrateSessionExecutionsAsync(ct); };
        await act.Should().NotThrowAsync("re-running the migration on already-migrated data must be safe");

        secondRun.Merged.Should().Be(0);
        secondRun.LogOnly.Should().Be(0);
        secondRun.CompletionOnly.Should().Be(0);
        secondRun.AdHoc.Should().Be(0);
        secondRun.Skipped.Should().Be(1, "the already-migrated key must be skipped, not re-processed");

        var allExecutions = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Empty).ToListAsync(ct);
        allExecutions.Should().HaveCount(1, "re-running must not create a duplicate document for the same key");

        var afterSecondRun = allExecutions.Single();
        afterSecondRun.Should().BeEquivalentTo(afterFirstRun,
            "a second (and third) run must mutate 0 documents — the already-migrated document is untouched");
    }

    // ── (4) PARTIAL-INTERRUPTION RESUME ──────────────────────────────────────────────

    [Fact]
    public async Task MigrateSessionExecutionsAsync_PartialInterruptionResume_MigratesRemainderWithoutTouchingAlreadyMigrated()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_partial_test", ct);
        await using var containerDisposable = container;

        // Client A: simulates progress made before an interruption — a SessionExecution
        // already exists at this (clientId, sessionId, date) key, inserted directly (not via
        // the migration) with content that would NOT match what a fresh migration run would
        // produce, so any accidental re-processing is unambiguously detectable.
        var clientAId = Guid.NewGuid();
        var sessionAId = Guid.NewGuid();
        var dateA = DateTime.UtcNow.Date;
        var preExistingExecution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientAId,
            SessionId = sessionAId,
            Date = dateA,
            Status = SessionExecutionStatus.Completed,
            CompletedExerciseIds = [Guid.NewGuid()],
            DateCreated = dateA.AddDays(-1),
            Version = 1
        };
        await mongo.SessionExecutions.InsertOneAsync(preExistingExecution, cancellationToken: ct);

        // Also seed a WorkoutLog/TrainingCompletion pair for client A at the SAME key — this
        // mirrors the real migration's pre-flight `AnyAsync(existingFilter)` skip check: the
        // source documents are still present (nothing deletes them), but the key is already
        // migrated, so the remainder logic must leave it alone.
        var exerciseAId = Guid.NewGuid();
        var logA = BuildLog(clientAId, Guid.NewGuid(), sessionAId, dateA, isCompleted: true, exerciseAId);
        await mongo.WorkoutLogs.InsertOneAsync(logA, cancellationToken: ct);

        // Client B: not yet migrated — a fresh log-only key.
        var clientBId = Guid.NewGuid();
        var planBId = Guid.NewGuid();
        var sessionBId = Guid.NewGuid();
        var exerciseBId = Guid.NewGuid();
        var dateB = DateTime.UtcNow.Date;
        var logB = BuildLog(clientBId, planBId, sessionBId, dateB, isCompleted: true, exerciseBId);
        await mongo.WorkoutLogs.InsertOneAsync(logB, cancellationToken: ct);

        // Resume the migration (simulating the retry after a mid-batch crash/interruption).
        var initializer = CreateInitializer(mongo);
        var (merged, logOnly, completionOnly, adHoc, skipped) = await initializer.MigrateSessionExecutionsAsync(ct);

        merged.Should().Be(0);
        logOnly.Should().Be(1, "only client B's not-yet-migrated key must be processed by the resumed run");
        completionOnly.Should().Be(0);
        adHoc.Should().Be(0);
        skipped.Should().Be(1, "client A's key is already migrated and must be skipped");

        // Client B's remainder was completed by the resumed run.
        var executionB = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, logB.ExternalId))
            .FirstOrDefaultAsync(ct);
        executionB.Should().NotBeNull("the remainder (client B) must be migrated by the resumed run");
        executionB!.ClientId.Should().Be(clientBId);
        executionB.SessionId.Should().Be(sessionBId);

        // Client A's pre-existing document is byte-for-byte untouched by the resumed run.
        var executionAAfterResume = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientAId)
                & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionAId)
                & Builders<SessionExecution>.Filter.Eq(e => e.Date, dateA))
            .FirstOrDefaultAsync(ct);
        executionAAfterResume.Should().NotBeNull();
        executionAAfterResume.Should().BeEquivalentTo(preExistingExecution,
            "the resumed run must not touch the already-migrated client A document, even though its " +
            "source WorkoutLog is still present");

        var totalExecutions = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Empty).ToListAsync(ct);
        totalExecutions.Should().HaveCount(2, "exactly one pre-existing (client A) plus one newly-migrated (client B) document");
    }

    // ── (5) M1 (#841) — E11000 TOCTOU GUARD ──────────────────────────────────────────
    //
    // Render deploys the migration CLI arg (--migrate-session-executions) while the
    // service keeps serving live traffic — there is no maintenance window. The up-front
    // existence check MigrateSessionExecutionsAsync runs per key is a plain, unlocked
    // read; a concurrent live write for the same identity can land between that check
    // and the migration's own InsertOneAsync. These two tests reproduce that race
    // deterministically via the test-only BeforePlanBoundInsertAsync / BeforeAdHocInsertAsync
    // hooks (fired at the exact point the race would occur) instead of relying on real
    // thread timing, and prove the resulting E11000 is swallowed — counted as skipped —
    // rather than bubbling up and aborting the rest of the migration run.

    [Fact]
    public async Task MigrateSessionExecutionsAsync_ConcurrentLiveInsertBetweenCheckAndInsert_PlanBound_SkipsWithoutThrowing()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_toctou_planbound_test", ct);
        await using var containerDisposable = container;

        var initializer = CreateInitializer(mongo);

        // The partial unique index (clientId, sessionId, date) is what turns this race into
        // an E11000 in the first place. MigrateSessionExecutionsAsync itself never creates
        // it — that's StartAsync's job, run once at boot — so without creating it here the
        // "concurrent" duplicate insert below would succeed silently and this test would
        // prove nothing.
        await initializer.CreateSessionExecutionIndexes(ct);

        var clientId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var log = BuildLog(clientId, planId, sessionId, date, isCompleted: true, exerciseId);
        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);

        // Simulate the concurrent live writer: e.g. the client finishing this workout via
        // the running API, in a separate process, landing at the exact same
        // (clientId, sessionId, date) identity right between the migration's up-front
        // existence check and its own insert.
        var concurrentWrite = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            SessionId = sessionId,
            Date = date,
            Status = SessionExecutionStatus.Completed,
            DateCreated = date,
            Version = 1
        };
        initializer.BeforePlanBoundInsertAsync = async (_, _, _) =>
        {
            initializer.BeforePlanBoundInsertAsync = null; // fire once
            await mongo.SessionExecutions.InsertOneAsync(concurrentWrite, cancellationToken: ct);
        };

        (long Merged, long LogOnly, long CompletionOnly, long AdHoc, long Skipped) result = default;
        var act = async () => { result = await initializer.MigrateSessionExecutionsAsync(ct); };

        await act.Should().NotThrowAsync(
            "an E11000 raised by a concurrent live write racing the migration's own insert must " +
            "be swallowed and counted as skipped, not bubble up and abort the whole migration run");

        result.Merged.Should().Be(0, "the migration's own insert lost the race, so it must not count itself as merged");
        result.LogOnly.Should().Be(0);
        result.CompletionOnly.Should().Be(0);
        result.AdHoc.Should().Be(0);
        result.Skipped.Should().Be(1, "the duplicate-key race must be counted as skipped");

        // Exactly the concurrent writer's document survives — the migration must not have
        // overwritten it or created a second document at the same key.
        var executions = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ClientId, clientId)
                & Builders<SessionExecution>.Filter.Eq(e => e.SessionId, sessionId)
                & Builders<SessionExecution>.Filter.Eq(e => e.Date, date))
            .ToListAsync(ct);
        executions.Should().HaveCount(1, "only the concurrent live writer's document must exist at this key");
        executions.Single().ExternalId.Should().Be(concurrentWrite.ExternalId,
            "the surviving document must be the concurrent writer's, not one the migration tried to insert");
    }

    [Fact]
    public async Task MigrateSessionExecutionsAsync_ConcurrentLiveInsertBetweenCheckAndInsert_AdHoc_SkipsWithoutThrowing()
    {
        var ct = TestContext.Current.CancellationToken;
        var (container, mongo) = await CreateMongoAsync("session_execution_toctou_adhoc_test", ct);
        await using var containerDisposable = container;

        var initializer = CreateInitializer(mongo);

        // Same rationale as the plan-bound test above, but this time it's the ExternalId
        // unique index (idx_sessionexecution_externalId) that the ad-hoc insert path relies
        // on to turn the race into an E11000.
        await initializer.CreateSessionExecutionIndexes(ct);

        var clientId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        // Ad-hoc (unplanned) log — no SessionId, so identity is the WorkoutLog's own ExternalId.
        var log = BuildLog(clientId, planId: null, sessionId: null, date, isCompleted: true, exerciseId);
        await mongo.WorkoutLogs.InsertOneAsync(log, cancellationToken: ct);

        // Concurrent live writer creates the SessionExecution at the SAME ExternalId
        // (carried over 1:1 from the source WorkoutLog per the migration's identity
        // contract) before the migration's own insert executes.
        var concurrentWrite = new SessionExecution
        {
            ExternalId = log.ExternalId,
            ClientId = clientId,
            Status = SessionExecutionStatus.Completed,
            DateCreated = date,
            Version = 1
        };
        initializer.BeforeAdHocInsertAsync = async _ =>
        {
            initializer.BeforeAdHocInsertAsync = null; // fire once
            await mongo.SessionExecutions.InsertOneAsync(concurrentWrite, cancellationToken: ct);
        };

        (long Merged, long LogOnly, long CompletionOnly, long AdHoc, long Skipped) result = default;
        var act = async () => { result = await initializer.MigrateSessionExecutionsAsync(ct); };

        await act.Should().NotThrowAsync(
            "an E11000 raised by a concurrent live write racing the migration's own ad-hoc insert " +
            "must be swallowed and counted as skipped, not bubble up and abort the whole migration run");

        result.Merged.Should().Be(0);
        result.LogOnly.Should().Be(0);
        result.CompletionOnly.Should().Be(0);
        result.AdHoc.Should().Be(0, "the migration's own ad-hoc insert lost the race, so it must not count itself");
        result.Skipped.Should().Be(1, "the duplicate-key race must be counted as skipped");

        var executions = await mongo.SessionExecutions
            .Find(Builders<SessionExecution>.Filter.Eq(e => e.ExternalId, log.ExternalId))
            .ToListAsync(ct);
        executions.Should().HaveCount(1, "only the concurrent live writer's document must exist at this ExternalId");
        executions.Single().ClientId.Should().Be(clientId);
    }
}
