using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// MongoDB-backed implementation of <see cref="ISessionLockService"/>.
/// Mutual exclusion is enforced by the unique index on <c>sessionId</c> —
/// an <c>InsertOneAsync</c> that violates it throws E11000, which is caught
/// and translated to <see cref="AcquireResult.LockConflict"/>.
/// </summary>
public class SessionLockService(IMongoContext mongo, ILogger<SessionLockService> logger)
    : ISessionLockService
{
    /// <inheritdoc />
    public async Task<AcquireResult> AcquireAsync(
        Guid sessionId,
        Guid planId,
        Guid clientId,
        Guid trainerId,
        LockHolder holder,
        LockType type,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var lockDoc = new SessionLock
        {
            SessionId  = sessionId,
            PlanId     = planId,
            ClientId   = clientId,
            TrainerId  = trainerId,
            Holder     = holder,
            Type       = type,
            AcquiredAt = now,
            ExpiresAt  = now.Add(ttl)
        };

        try
        {
            await mongo.SessionLocks.InsertOneAsync(lockDoc, cancellationToken: ct);
            return new AcquireResult.Acquired(lockDoc);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Code == 11000)
        {
            // E11000 duplicate key — another party already holds the session.
            logger.LogDebug(
                "Session lock contention on sessionId={SessionId}: {Message}",
                sessionId, ex.WriteError.Message);
            return new AcquireResult.LockConflict();
        }
    }

    /// <inheritdoc />
    public async Task<bool> ReleaseAsync(
        Guid sessionId,
        LockHolder holder,
        LockType type,
        CancellationToken ct = default)
    {
        // Intentional ownership guard: filter keys on sessionId AND holder AND type
        // so a caller cannot release a lock held by a different party.
        // DeleteOneAsync with zero matches is a successful no-op (idempotent).
        var filter = Builders<SessionLock>.Filter.Eq(l => l.SessionId, sessionId)
            & Builders<SessionLock>.Filter.Eq(l => l.Holder, holder)
            & Builders<SessionLock>.Filter.Eq(l => l.Type, type);

        var result = await mongo.SessionLocks.DeleteOneAsync(filter, ct);
        return result.DeletedCount > 0;
    }

    /// <inheritdoc />
    public async Task<bool> RefreshAsync(
        Guid sessionId,
        LockType type,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Expiry guard: only refresh locks that are still live (expiresAt > now).
        // A lock whose expiresAt <= now is logically expired and must not be revived.
        var filter = Builders<SessionLock>.Filter.Eq(l => l.SessionId, sessionId)
            & Builders<SessionLock>.Filter.Eq(l => l.Type, type)
            & Builders<SessionLock>.Filter.Gt(l => l.ExpiresAt, now);

        var update = Builders<SessionLock>.Update
            .Set(l => l.ExpiresAt, now.Add(ttl));

        var result = await mongo.SessionLocks.UpdateOneAsync(filter, update, cancellationToken: ct);
        return result.MatchedCount > 0;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<SessionLock>> GetStateAsync(
        IEnumerable<Guid> sessionIds,
        CancellationToken ct = default)
    {
        var idList = sessionIds.ToList();
        if (idList.Count == 0)
            return [];

        var now = DateTime.UtcNow;

        // Filter: sessionId in the requested set AND expiresAt > now.
        // The expiresAt > now guard ensures query-layer expiry is correct
        // even before the Mongo TTL reaper (~60s cycle) runs.
        var filter = Builders<SessionLock>.Filter.In(l => l.SessionId, idList)
            & Builders<SessionLock>.Filter.Gt(l => l.ExpiresAt, now);

        var results = await mongo.SessionLocks
            .Find(filter)
            .ToListAsync(ct);

        return results;
    }
}
