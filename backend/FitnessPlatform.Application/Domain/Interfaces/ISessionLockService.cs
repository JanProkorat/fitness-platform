using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Discriminated result for <see cref="ISessionLockService.AcquireAsync"/>.
/// The service never throws to the caller — contention is expressed as <see cref="LockConflict"/>.
/// </summary>
public abstract record AcquireResult
{
    private AcquireResult() { }

    /// <summary>
    /// The lock was acquired successfully.
    /// </summary>
    /// <param name="Lock">The newly-created lock document.</param>
    public sealed record Acquired(SessionLock Lock) : AcquireResult;

    /// <summary>
    /// The session is already locked by another party.
    /// </summary>
    public sealed record LockConflict : AcquireResult;
}

/// <summary>
/// Service for acquiring, releasing, and refreshing per-session edit/live locks.
/// </summary>
public interface ISessionLockService
{
    /// <summary>
    /// Acquires a lock on the given session.
    /// Uses <c>InsertOneAsync</c> under a unique index on <c>sessionId</c> so that
    /// concurrent callers obtain mutual exclusion without a read-modify-write cycle.
    /// </summary>
    /// <param name="sessionId">The session to lock.</param>
    /// <param name="planId">The plan the session belongs to.</param>
    /// <param name="clientId">The client user id (for SignalR fan-out).</param>
    /// <param name="trainerId">The trainer user id (for SignalR fan-out).</param>
    /// <param name="holder">Which party is acquiring the lock.</param>
    /// <param name="type">The purpose of the lock (Editing or Live).</param>
    /// <param name="ttl">How long the lock should be valid before auto-expiry.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// <see cref="AcquireResult.Acquired"/> on success,
    /// <see cref="AcquireResult.LockConflict"/> when the session is already locked.
    /// Never throws for a duplicate-key condition.
    /// </returns>
    Task<AcquireResult> AcquireAsync(
        Guid sessionId,
        Guid planId,
        Guid clientId,
        Guid trainerId,
        LockHolder holder,
        LockType type,
        TimeSpan ttl,
        CancellationToken ct = default);

    /// <summary>
    /// Releases an active lock on the given session.
    /// Idempotent: if the lock does not exist (already released or expired) this is a no-op success.
    /// </summary>
    /// <param name="sessionId">The session whose lock should be removed.</param>
    /// <param name="holder">The holder expected on the lock (used as a guard filter).</param>
    /// <param name="type">The type expected on the lock (used as a guard filter).</param>
    /// <param name="ct">Cancellation token.</param>
    Task ReleaseAsync(
        Guid sessionId,
        LockHolder holder,
        LockType type,
        CancellationToken ct = default);

    /// <summary>
    /// Slides the <c>ExpiresAt</c> field forward on an existing lock (keep-alive for live sessions).
    /// </summary>
    /// <param name="sessionId">The session whose lock should be refreshed.</param>
    /// <param name="type">The lock type (used as a filter guard).</param>
    /// <param name="ttl">The new TTL duration, measured from <c>DateTime.UtcNow</c>.</param>
    /// <param name="ct">Cancellation token.</param>
    Task RefreshAsync(
        Guid sessionId,
        LockType type,
        TimeSpan ttl,
        CancellationToken ct = default);

    /// <summary>
    /// Returns the set of currently active (non-expired) locks for the given session ids.
    /// A session whose lock doc has <c>ExpiresAt &lt;= UtcNow</c> is treated as absent
    /// (i.e. <c>Stable</c>) at the query layer without waiting for the Mongo TTL reaper.
    /// </summary>
    /// <param name="sessionIds">Session ids to query.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>All active lock documents for the requested sessions.</returns>
    Task<IReadOnlyList<SessionLock>> GetStateAsync(
        IEnumerable<Guid> sessionIds,
        CancellationToken ct = default);
}
