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
    /// </summary>
    [Fact]
    public async Task AcquireAsync_TwoParallelAcquires_ExactlyOneAcquiredOneLockConflict()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, planId, clientId, trainerId) = NewIds();

        var ttl = TimeSpan.FromHours(2);

        // Fire both acquires concurrently without yielding between them.
        var task1 = _sut.AcquireAsync(sessionId, planId, clientId, trainerId,
            LockHolder.Coach, LockType.Editing, ttl, ct);
        var task2 = _sut.AcquireAsync(sessionId, planId, clientId, trainerId,
            LockHolder.Client, LockType.Live, ttl, ct);

        var results = await Task.WhenAll(task1, task2);

        var acquiredCount    = results.Count(r => r is AcquireResult.Acquired);
        var conflictCount    = results.Count(r => r is AcquireResult.LockConflict);

        acquiredCount.Should().Be(1,  "exactly one caller wins the mutual exclusion");
        conflictCount.Should().Be(1,  "the other caller must receive LockConflict, not an exception");
    }

    /// <summary>
    /// ReleaseAsync on a non-existent lock (never acquired or already expired)
    /// must return without throwing — idempotent no-op.
    /// </summary>
    [Fact]
    public async Task ReleaseAsync_NonExistentLock_IsIdempotentNoOp()
    {
        var ct = TestContext.Current.CancellationToken;
        var (sessionId, _, _, _) = NewIds();

        // No lock has been acquired for this session.
        var act = () => _sut.ReleaseAsync(sessionId, LockHolder.Coach, LockType.Editing, ct);

        await act.Should().NotThrowAsync("releasing a non-existent lock is a silent no-op");
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
        await _sut.RefreshAsync(sessionId, LockType.Live, TimeSpan.FromHours(6), ct);

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
}
