using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests for <see cref="SessionLockService"/>.
///
/// Boots a real MongoDB container, seeds the <c>sessionLocks</c> collection, and verifies
/// the acquire/release/refresh/getState contracts including E11000 duplicate-key handling.
/// </summary>
public class SessionLockServiceTests : IAsyncLifetime
{
    // Wide timeout to absorb contention when the compose harness is also running.
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoContext  _mongoCtx = null!;
    private ISessionLockService _sut = null!;

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var mongoDb     = mongoClient.GetDatabase("fitness_sessionlock_test");
        _mongoCtx = new MongoContext(mongoDb);

        // Create the unique index on sessionId that SessionLockService depends on.
        // In production this is done by MongoIndexInitializer at startup.
        var uniqueIndex = new CreateIndexModel<Application.Domain.Documents.SessionLock>(
            Builders<Application.Domain.Documents.SessionLock>.IndexKeys.Ascending(l => l.SessionId),
            new CreateIndexOptions { Name = "idx_sessionlock_sessionId", Unique = true });
        await _mongoCtx.SessionLocks.Indexes.CreateOneAsync(
            uniqueIndex, cancellationToken: TestContext.Current.CancellationToken);

        _sut = new SessionLockService(_mongoCtx, NullLogger<SessionLockService>.Instance);
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static (Guid sessionId, Guid planId, Guid clientId, Guid trainerId) NewIds() =>
        (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Two parallel AcquireAsync calls for the same sessionId:
    /// exactly one must succeed (Acquired) and the other must return LockConflict —
    /// never throw, never return two Acquired results.
    ///
    /// Run 20 independent iterations, each with a fresh sessionId, using a
    /// <see cref="Barrier"/> to release both tasks simultaneously. This prevents
    /// the test from passing merely because the OS serialized the two tasks.
    /// </summary>
    [Fact]
    public async Task AcquireAsync_TwoParallelAcquires_ExactlyOneAcquiredOneLockConflict()
    {
        var ct = TestContext.Current.CancellationToken;
        var ttl = TimeSpan.FromHours(2);

        for (var iteration = 0; iteration < 20; iteration++)
        {
            var (sessionId, planId, clientId, trainerId) = NewIds();

            // Barrier with participant count = 2 + 1 (the two tasks + this thread).
            // Both tasks wait at the barrier before firing their insert, ensuring
            // genuine concurrency rather than OS-level serialization.
            using var barrier = new Barrier(3);

            var task1 = Task.Run(async () =>
            {
                barrier.SignalAndWait(ct);
                return await _sut.AcquireAsync(sessionId, planId, clientId, trainerId,
                    LockHolder.Coach, LockType.Editing, ttl, ct);
            }, ct);

            var task2 = Task.Run(async () =>
            {
                barrier.SignalAndWait(ct);
                return await _sut.AcquireAsync(sessionId, planId, clientId, trainerId,
                    LockHolder.Client, LockType.Live, ttl, ct);
            }, ct);

            // Release both tasks simultaneously from this thread.
            barrier.SignalAndWait(ct);

            var results = await Task.WhenAll(task1, task2);

            var acquiredCount = results.Count(r => r is AcquireResult.Acquired);
            var conflictCount = results.Count(r => r is AcquireResult.LockConflict);

            acquiredCount.Should().Be(1,
                $"iteration {iteration}: exactly one caller must win the mutual exclusion");
            conflictCount.Should().Be(1,
                $"iteration {iteration}: the other caller must receive LockConflict, not an exception");

            // Clean up the lock so the next iteration can reuse fresh ids cleanly.
            await _mongoCtx.SessionLocks.DeleteManyAsync(
                Builders<Application.Domain.Documents.SessionLock>.Filter.Eq(l => l.SessionId, sessionId),
                cancellationToken: ct);
        }
    }

    /// <summary>
    /// ReleaseAsync on a non-existent lock (never acquired or already expired)
    /// must return without throwing — idempotent no-op, returns false.
    /// </summary>
    [Fact]
    public async Task ReleaseAsync_NonExistentLock_IsIdempotentNoOp()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, _, _, _) = NewIds();

        // No lock has been acquired for this session.
        var released = await _sut.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);

        released.Should().BeFalse("releasing a non-existent lock is a silent no-op that returns false");
    }

    /// <summary>
    /// A session lock with an <c>ExpiresAt</c> in the past must be treated as absent
    /// (i.e. Stable) by <see cref="ISessionLockService.GetStateAsync"/>, even though
    /// the physical document still exists (the Mongo TTL reaper has not run yet).
    /// </summary>
    [Fact]
    public async Task GetStateAsync_PastExpiresAt_TreatedAsAbsent()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();

        // Acquire a lock normally, then manually overwrite ExpiresAt to a past instant
        // to simulate a TTL doc that hasn't been reaped yet.
        var acquireResult = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Coach, LockType.Editing,
            TimeSpan.FromHours(2), ct);

        acquireResult.Should().BeOfType<AcquireResult.Acquired>();

        // Directly set expiresAt to the past in the collection (bypassing the service).
        var expiredAt = DateTime.UtcNow.AddHours(-1);
        await _mongoCtx.SessionLocks.UpdateOneAsync(
            Builders<Application.Domain.Documents.SessionLock>.Filter.Eq(l => l.SessionId, sessionId),
            Builders<Application.Domain.Documents.SessionLock>.Update.Set(l => l.ExpiresAt, expiredAt),
            cancellationToken: ct);

        // GetStateAsync must honour the expiresAt > now filter and return nothing.
        var state = await _sut.GetStateAsync([sessionId], ct);

        state.Should().BeEmpty(
            "a lock doc with expiresAt in the past must be treated as absent (Stable) " +
            "at the query layer before the TTL reaper physically removes it");
    }

    /// <summary>
    /// RefreshAsync must slide <c>ExpiresAt</c> strictly forward.
    /// </summary>
    [Fact]
    public async Task RefreshAsync_ExtendsExpiresAt()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();

        // Acquire with a short TTL.
        var acquireResult = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Client, LockType.Live,
            TimeSpan.FromMinutes(30), ct);

        acquireResult.Should().BeOfType<AcquireResult.Acquired>();
        var originalExpiresAt = ((AcquireResult.Acquired)acquireResult).Lock.ExpiresAt;

        // Small delay to ensure UtcNow is measurably later.
        await Task.Delay(10, ct);

        // Refresh with a longer TTL.
        var refreshed = await _sut.RefreshAsync(sessionId, LockType.Live, TimeSpan.FromHours(6), ct);
        refreshed.Should().BeTrue("the lock is still live and must be refreshable");

        // Read back from the collection.
        var updated = await _mongoCtx.SessionLocks
            .Find(Builders<Application.Domain.Documents.SessionLock>.Filter.Eq(l => l.SessionId, sessionId))
            .FirstOrDefaultAsync(ct);

        updated.Should().NotBeNull("the lock document must still exist after refresh");
        updated!.ExpiresAt.Should().BeAfter(originalExpiresAt,
            "RefreshAsync must slide ExpiresAt strictly forward");
    }

    /// <summary>
    /// GetStateAsync returns only the live (non-expired) locks for the requested sessions
    /// in a batch containing a mix of locked and unlocked sessions.
    /// </summary>
    [Fact]
    public async Task GetStateAsync_BatchMix_ReturnsOnlyActiveLocks()
    {
        var ct = TestContext.Current.CancellationToken;

        // Session A: has an active lock.
        var (sessionA, planId, clientId, trainerId) = NewIds();
        var sessionB = Guid.NewGuid(); // no lock at all
        var sessionC = Guid.NewGuid(); // expired lock

        await _sut.AcquireAsync(sessionA, planId, clientId, trainerId,
            LockHolder.Client, LockType.Live, TimeSpan.FromHours(6), ct);

        // Force an expired lock for session C via direct insert (expiresAt in the past).
        var expiredLock = new Application.Domain.Documents.SessionLock
        {
            SessionId  = sessionC,
            PlanId     = planId,
            ClientId   = clientId,
            TrainerId  = trainerId,
            Holder     = LockHolder.Coach,
            Type       = LockType.Editing,
            AcquiredAt = DateTime.UtcNow.AddHours(-3),
            ExpiresAt  = DateTime.UtcNow.AddHours(-1)   // already expired
        };
        await _mongoCtx.SessionLocks.InsertOneAsync(expiredLock, cancellationToken: ct);

        // Query all three.
        var state = await _sut.GetStateAsync([sessionA, sessionB, sessionC], ct);

        state.Should().HaveCount(1, "only sessionA has a non-expired active lock");
        state[0].SessionId.Should().Be(sessionA);
    }

    /// <summary>
    /// Acquire → Release (returns true) → Acquire again succeeds.
    /// Verifies that a successful Release physically removes the lock and allows re-acquisition.
    /// </summary>
    [Fact]
    public async Task ReleaseAsync_ExistingLock_ReturnsTrueAndAllowsReacquire()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();
        var ttl = TimeSpan.FromHours(2);

        // Acquire the lock.
        var firstAcquire = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Coach, LockType.Editing, ttl, ct);
        firstAcquire.Should().BeOfType<AcquireResult.Acquired>("initial acquire must succeed");

        // Release — must return true (a document was deleted).
        var released = await _sut.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);
        released.Should().BeTrue("a matching lock was present and must have been deleted");

        // Re-acquire — must succeed now that the lock is gone.
        var secondAcquire = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Client, LockType.Live, ttl, ct);
        secondAcquire.Should().BeOfType<AcquireResult.Acquired>(
            "after release the session is free and a new acquire must succeed");
    }

    /// <summary>
    /// ReleaseAsync with the wrong holder must be a no-op (returns false) and must NOT
    /// delete the lock held by the correct holder.
    /// This verifies the intentional ownership guard in the delete filter
    /// (sessionId AND holder AND type).
    /// </summary>
    [Fact]
    public async Task ReleaseAsync_WrongHolder_NoOpsAndLockPersists()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();
        var ttl = TimeSpan.FromHours(2);

        // Acquire a Coach/Editing lock.
        var acquireResult = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Coach, LockType.Editing, ttl, ct);
        acquireResult.Should().BeOfType<AcquireResult.Acquired>();

        // Attempt to release using the wrong holder (Client instead of Coach).
        var released = await _sut.ReleaseAsync(sessionId, LockHolder.Client, LockType.Editing, ct);
        released.Should().BeFalse(
            "the wrong holder must not be able to release someone else's lock (ownership guard)");

        // The original lock must still exist and be visible to GetStateAsync.
        var state = await _sut.GetStateAsync([sessionId], ct);
        state.Should().HaveCount(1, "the lock held by Coach must not have been deleted");
        state[0].Holder.Should().Be(LockHolder.Coach);
    }

    /// <summary>
    /// RefreshAsync on a logically-expired lock (ExpiresAt in the past) must return false
    /// without reviving the lock — consistent with GetStateAsync's expiresAt &gt; now semantics.
    /// </summary>
    [Fact]
    public async Task RefreshAsync_ExpiredLock_ReturnsFalseAndDoesNotRevive()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();

        // Acquire normally, then rewind ExpiresAt to the past via direct update.
        var acquireResult = await _sut.AcquireAsync(
            sessionId, planId, clientId, trainerId,
            LockHolder.Client, LockType.Live,
            TimeSpan.FromHours(1), ct);
        acquireResult.Should().BeOfType<AcquireResult.Acquired>();

        var pastExpiry = DateTime.UtcNow.AddHours(-1);
        await _mongoCtx.SessionLocks.UpdateOneAsync(
            Builders<Application.Domain.Documents.SessionLock>.Filter.Eq(l => l.SessionId, sessionId),
            Builders<Application.Domain.Documents.SessionLock>.Update.Set(l => l.ExpiresAt, pastExpiry),
            cancellationToken: ct);

        // Refresh must not revive an expired lock.
        var refreshed = await _sut.RefreshAsync(sessionId, LockType.Live, TimeSpan.FromHours(6), ct);
        refreshed.Should().BeFalse("an expired lock is logically absent and must not be refreshed");

        // GetStateAsync must still treat the lock as absent.
        var state = await _sut.GetStateAsync([sessionId], ct);
        state.Should().BeEmpty("the lock remains expired even after a failed refresh attempt");
    }
}
