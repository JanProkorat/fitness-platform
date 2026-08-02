using FastEndpoints;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Endpoint-facing 404/403/409 responses for the four sharing-library features (meal, session,
/// nutrition-plan, training-plan templates), built on top of <see cref="LibraryAccessGuard"/>'s
/// pure predicates. Centralizes the three distinct denial/conflict outcomes so no consuming
/// endpoint accidentally leaks another owner's Private entry via a 403 (id enumeration),
/// produces a 404 where a 403 is required, or invents its own 409 shape.
/// </summary>
/// <remarks>
/// <para>
/// <b>Fetch and guard together, never separately.</b>
/// <see cref="LoadLibraryEntryForReadOrRespondAsync{TDoc}"/> and
/// <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> are the sole sanctioned entry
/// points for obtaining a sharing-library document outside a version-gated write: each fetches
/// by <c>ExternalId</c> alone (never owner-scoped — owner-scoping the lookup filter collapses
/// readable-but-not-owned into a 404, which is the exact bug this type exists to prevent) and
/// then runs the matching guard before ever handing the document back. A consumer that only
/// ever calls one of these two methods cannot obtain a document without having already passed
/// the guard. <see cref="TryDenyReadAsync"/> and <see cref="TryDenyWriteAsync"/> remain public
/// for the rare case a consumer already has the document via some other guarded path, but
/// ordinary sharing-library endpoints should call the <c>Load*OrRespondAsync</c> helpers and
/// never fetch by <c>ExternalId</c> directly.
/// </para>
/// <para>
/// <b>Version-gated writes are the one documented exception, and it is no longer prose-only.</b>
/// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> performs its own
/// fetch-by-filter and hands the result to its <c>mutate</c> delegate with no ownership check —
/// composing it with <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> by hand (call
/// the loader, then separately call the guard) previously relied on a caller reading this class's
/// remarks and getting the order right, which is exactly the kind of guarantee that degrades to
/// "we hope nobody skips it." <see cref="LoadAndReplaceLibraryEntryWithVersionGuardAsync{TDoc}"/>
/// removes that reliance for a caller who uses it: it is the sole sanctioned entry point for a
/// version-gated sharing-library write, and it sequences fetch → denial guard → version check →
/// replace internally, so a caller who goes through <i>this</i> method cannot get the order
/// wrong. This does not make the wrong order unrepresentable by every caller of this API —
/// <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> and
/// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> both remain public, so
/// an endpoint could still inject the guard directly and call it with no denial check ahead of
/// it. What this method changes is that the correct sequencing is now the available, sanctioned
/// path rather than a convention documented only in prose — a real improvement, not an
/// enforcement guarantee.
/// </para>
/// <para>
/// <b>General ordering rule — read this before adding any check on the fetched document.</b> Any
/// endpoint-specific check that reads a fact off the fetched document — a status/state-machine
/// guard (e.g. <c>TrainingPlanStatus.Archived</c>), a completion guard (e.g.
/// <c>SESSION_ALREADY_COMPLETED</c>), a lock guard (e.g. <c>session_locked</c>), or any other
/// business-rule condition — MUST run <i>after</i> the denial check
/// (<see cref="TryDenyReadAsync"/>/<see cref="TryDenyWriteAsync"/>, or the guard embedded in the
/// <c>Load*OrRespondAsync</c> / <c>LoadAndReplaceLibraryEntryWithVersionGuardAsync{TDoc}</c>
/// helpers), never before. A check placed ahead of the denial hands a non-owner probing another
/// owner's Private entry a response derived from that entry's internal state (e.g. a 409
/// "already archived") before the caller has been confirmed to have any right to know the entry
/// exists at all — existence disclosed via a side channel the 404/403 pinning above does not
/// cover.
/// </para>
/// </remarks>
public static class LibraryDenialExtensions
{
    /// <summary>
    /// Writes the single, shared 404 response for a sharing-library entry — used identically
    /// for a genuinely-missing document and for another owner's unreadable Private entry, so
    /// the two cases are byte-for-byte indistinguishable. Does NOT throw — the caller must
    /// return after this call.
    /// </summary>
    /// <remarks>
    /// Called internally by <see cref="LoadLibraryEntryForReadOrRespondAsync{TDoc}"/>,
    /// <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>, and <see cref="TryDenyReadAsync"/>/
    /// <see cref="TryDenyWriteAsync"/>'s denied-read branch — every sharing-library 404, missing
    /// or denied, routes through this one method. Do not call
    /// <c>Send.NotFoundAsync(ct)</c> (the repo's usual empty-bodied 404, e.g.
    /// <c>UpdatePlanEndpoint.cs</c>) for a sharing-library entry: that produces a structurally
    /// different response (no body, no <c>errorCode</c>) than the Problem Details body this
    /// method writes, which is a one-request existence oracle.
    /// </remarks>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task SendLibraryNotFoundAsync(
        this IEndpoint endpoint,
        LibraryDenial denial,
        CancellationToken ct) =>
        await endpoint.SendProblemAsync(404, denial.NotFoundErrorCode, denial.NotFoundDetail, ct);

    /// <summary>
    /// Writes the shared 409 response for an optimistic-concurrency conflict on a sharing-library
    /// entry (a stale caller-supplied <c>Version</c>, or a lost <c>ReplaceOneAsync</c> race under
    /// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>). Pins one response
    /// shape across all four libraries' <c>*_VERSION_CONFLICT</c> error codes, the same way
    /// <see cref="SendLibraryNotFoundAsync"/> pins the 404 shape and the 403 branch inside
    /// <see cref="TryDenyWriteAsync"/> pins the 403 shape — so 409 is not the one denial outcome
    /// each child endpoint invents its own body for. Takes the same <see cref="LibraryDenial"/> as
    /// every other denial outcome: <see cref="LibraryDenial.VersionConflictErrorCode"/> and
    /// <see cref="LibraryDenial.VersionConflictDetail"/> used to be two loose, adjacent
    /// <c>string</c> parameters here — exactly the transposable-pair hazard
    /// <see cref="LibraryDenial"/> exists to remove for the 404/403 strings, reintroduced for the
    /// 409 pair. Folding them in puts all six per-library denial strings behind one declaration.
    /// Does NOT throw — the caller must return after this call.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task SendLibraryVersionConflictAsync(
        this IEndpoint endpoint,
        LibraryDenial denial,
        CancellationToken ct) =>
        await endpoint.SendProblemAsync(409, denial.VersionConflictErrorCode, denial.VersionConflictDetail, ct);

    /// <summary>
    /// Enforces read access for a library entry already fetched by <c>ExternalId</c> alone.
    /// Writes a 404 when the caller cannot read the entry (another owner's Private entry —
    /// indistinguishable from a missing entry, in body, headers, and timing). Returns
    /// <c>true</c> when the response was written and the endpoint must return immediately;
    /// <c>false</c> when the caller may proceed.
    /// </summary>
    /// <remarks>
    /// Prefer <see cref="LoadLibraryEntryForReadOrRespondAsync{TDoc}"/>, which performs the
    /// <c>ExternalId</c> fetch and this guard as one atomic call. Call this directly only when
    /// the document was already obtained through some other guarded path.
    /// </remarks>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="ownerId">The fetched entry's owner id.</param>
    /// <param name="visibility">The fetched entry's visibility.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> TryDenyReadAsync(
        this IEndpoint endpoint,
        Guid callerId,
        Guid ownerId,
        LibraryVisibility visibility,
        LibraryDenial denial,
        CancellationToken ct)
    {
        if (LibraryAccessGuard.CanRead(callerId, ownerId, visibility))
        {
            return false;
        }

        await endpoint.SendLibraryNotFoundAsync(denial, ct);
        return true;
    }

    /// <summary>
    /// Enforces write access for a library entry already fetched by <c>ExternalId</c> alone.
    /// Writes a 404 when the caller cannot even read the entry (another owner's Private entry),
    /// or a 403 when the caller can read it but does not own it (another owner's Public entry).
    /// Returns <c>true</c> when a response was written and the endpoint must return immediately;
    /// <c>false</c> when the caller may proceed to mutate/persist.
    /// </summary>
    /// <remarks>
    /// Prefer <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>, which performs the
    /// <c>ExternalId</c> fetch and this guard as one atomic call. Call this directly only when
    /// the document was already obtained through some other guarded path.
    /// </remarks>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="ownerId">The fetched entry's owner id.</param>
    /// <param name="visibility">The fetched entry's visibility.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> TryDenyWriteAsync(
        this IEndpoint endpoint,
        Guid callerId,
        Guid ownerId,
        LibraryVisibility visibility,
        LibraryDenial denial,
        CancellationToken ct)
    {
        if (!LibraryAccessGuard.CanRead(callerId, ownerId, visibility))
        {
            await endpoint.SendLibraryNotFoundAsync(denial, ct);
            return true;
        }

        if (!LibraryAccessGuard.CanWrite(callerId, ownerId))
        {
            await endpoint.SendProblemAsync(403, denial.NotOwnedErrorCode, denial.NotOwnedDetail, ct);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Fetches a sharing-library entry by <c>ExternalId</c> alone and enforces read access on it
    /// as a single atomic operation. Returns the document when the caller may read it;
    /// returns <c>null</c> after already writing the 404 response (missing document, or another
    /// owner's unreadable Private entry) when the caller may not. The caller must return
    /// immediately on a <c>null</c> result.
    /// </summary>
    /// <typeparam name="TDoc">The sharing-library document type.</typeparam>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="collection">The Mongo collection to fetch from.</param>
    /// <param name="externalId">The entry's public-facing identifier.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<TDoc?> LoadLibraryEntryForReadOrRespondAsync<TDoc>(
        this IEndpoint endpoint,
        IMongoCollection<TDoc> collection,
        Guid externalId,
        Guid callerId,
        LibraryDenial denial,
        CancellationToken ct)
        where TDoc : class, ILibraryDocument
    {
        var doc = await FetchByExternalIdAsync(collection, externalId, ct);

        if (doc is null)
        {
            await endpoint.SendLibraryNotFoundAsync(denial, ct);
            return default;
        }

        if (await endpoint.TryDenyReadAsync(callerId, doc.OwnerId, doc.Visibility, denial, ct))
        {
            return default;
        }

        return doc;
    }

    /// <summary>
    /// Fetches a sharing-library entry by <c>ExternalId</c> alone and enforces write access on it
    /// as a single atomic operation. Returns the document when the caller owns it; returns
    /// <c>null</c> after already writing the 404 (missing, or another owner's unreadable Private
    /// entry) or 403 (readable but not owned) response when the caller may not write. The caller
    /// must return immediately on a <c>null</c> result.
    /// </summary>
    /// <remarks>
    /// <b>Do not compose this method with <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>
    /// by hand for a version-gated write.</b> Use
    /// <see cref="LoadAndReplaceLibraryEntryWithVersionGuardAsync{TDoc}"/> instead — it sequences
    /// this method's fetch-and-guard with the version-gated replace internally, so the ordering
    /// this remark used to only describe in prose is now enforced by the method signature itself.
    /// Call this method directly only for a write endpoint that is NOT version-gated (rare among
    /// the sharing libraries — none of the four current ones qualify).
    /// </remarks>
    /// <typeparam name="TDoc">The sharing-library document type.</typeparam>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="collection">The Mongo collection to fetch from.</param>
    /// <param name="externalId">The entry's public-facing identifier.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="denial">The calling library's pinned denial strings.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<TDoc?> LoadLibraryEntryForWriteOrRespondAsync<TDoc>(
        this IEndpoint endpoint,
        IMongoCollection<TDoc> collection,
        Guid externalId,
        Guid callerId,
        LibraryDenial denial,
        CancellationToken ct)
        where TDoc : class, ILibraryDocument
    {
        var doc = await FetchByExternalIdAsync(collection, externalId, ct);

        if (doc is null)
        {
            await endpoint.SendLibraryNotFoundAsync(denial, ct);
            return default;
        }

        if (await endpoint.TryDenyWriteAsync(callerId, doc.OwnerId, doc.Visibility, denial, ct))
        {
            return default;
        }

        return doc;
    }

    /// <summary>
    /// Composes <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> with
    /// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> as a single
    /// operation: fetch by <c>ExternalId</c> alone → run the write-denial guard (404/403, return
    /// <c>null</c> on denial) → version-check → <paramref name="mutate"/> → version-gated
    /// <c>ReplaceOneAsync</c>. This is the sole sanctioned entry point for a version-gated
    /// sharing-library write — composing the two guards manually is exactly the ordering hazard
    /// this method exists to close (see the class-level remarks above). Returns the replaced
    /// document on success; returns <c>null</c> after already writing the matching response
    /// (404, 403, or 409) for every other outcome. The caller must return immediately on a
    /// <c>null</c> result.
    /// </summary>
    /// <remarks>
    /// This composes over <see cref="PlanConcurrencyGuard"/> rather than reimplementing its
    /// fetch/version-check/replace skeleton — <see cref="PlanConcurrencyGuard"/> is explicitly
    /// out of scope to modify (issue #858), and its existing CAS logic is already covered by
    /// <c>PlanConcurrencyGuardTests</c>. Composition means this method's own fetch inside
    /// <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> and the guard's internal fetch
    /// inside <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/> are two
    /// separate round-trips to Mongo — a deliberate cost. If the document is deleted between the
    /// two (a narrow concurrent-delete race), <see cref="PlanConcurrencyOutcome.NotFound"/> maps
    /// to the same 404 the denial guard would have produced, and discloses nothing new: the
    /// caller already passed the denial guard immediately before, so it already knows the entry
    /// existed and was theirs.
    /// </remarks>
    /// <typeparam name="TDoc">The sharing-library document type.</typeparam>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="collection">The Mongo collection to read from and write to.</param>
    /// <param name="externalId">The entry's public-facing identifier.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="denial">
    /// The calling library's pinned denial strings, including
    /// <see cref="LibraryDenial.VersionConflictErrorCode"/> and
    /// <see cref="LibraryDenial.VersionConflictDetail"/> used for the 409 branch — there is no
    /// separate version-conflict code/detail pair to pass alongside this.
    /// </param>
    /// <param name="expectedVersion">The version the caller expects the document to currently have.</param>
    /// <param name="guard">The shared version-gated fetch-check-replace-409 skeleton, DI-injected in the calling endpoint.</param>
    /// <param name="mutate">
    /// Endpoint-specific validation and mutation logic, run only against a document whose caller
    /// has already been confirmed as owner. Must mutate the document in place, including bumping
    /// its own version and updated-at fields. May throw to short-circuit (e.g. via FastEndpoints'
    /// <c>ThrowError</c>). For error paths that already write a response directly, the delegate
    /// must return <c>false</c> to signal the guard to stop before <c>ReplaceOneAsync</c>.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<TDoc?> LoadAndReplaceLibraryEntryWithVersionGuardAsync<TDoc>(
        this IEndpoint endpoint,
        IMongoCollection<TDoc> collection,
        Guid externalId,
        Guid callerId,
        LibraryDenial denial,
        int expectedVersion,
        PlanConcurrencyGuard guard,
        Func<TDoc, CancellationToken, Task<bool>> mutate,
        CancellationToken ct)
        where TDoc : class, ILibraryDocument
    {
        var doc = await endpoint.LoadLibraryEntryForWriteOrRespondAsync(
            collection, externalId, callerId, denial, ct);

        if (doc is null)
        {
            return default;
        }

        var lookupFilter = Builders<TDoc>.Filter.Eq(d => d.ExternalId, externalId);
        var replaceFilter = lookupFilter & Builders<TDoc>.Filter.Eq(d => d.Version, expectedVersion);

        var result = await guard.ReplaceWithVersionGuardAsync(
            collection, lookupFilter, replaceFilter, expectedVersion, d => d.Version, mutate, ct);

        switch (result.Outcome)
        {
            case PlanConcurrencyOutcome.NotFound:
                await endpoint.SendLibraryNotFoundAsync(denial, ct);
                return default;
            case PlanConcurrencyOutcome.VersionConflict:
            case PlanConcurrencyOutcome.ReplaceConflict:
                await endpoint.SendLibraryVersionConflictAsync(denial, ct);
                return default;
            case PlanConcurrencyOutcome.HandledByMutator:
                return default;
            case PlanConcurrencyOutcome.Success:
                return result.Document;
            default:
                throw new InvalidOperationException(
                    $"Unhandled {nameof(PlanConcurrencyOutcome)} value '{result.Outcome}' — " +
                    "add an explicit case rather than falling through to an implicit success.");
        }
    }

    private static async Task<TDoc?> FetchByExternalIdAsync<TDoc>(
        IMongoCollection<TDoc> collection,
        Guid externalId,
        CancellationToken ct)
        where TDoc : class, ILibraryDocument
    {
        var cursor = await collection.FindAsync(
            Builders<TDoc>.Filter.Eq(d => d.ExternalId, externalId), cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }
}
