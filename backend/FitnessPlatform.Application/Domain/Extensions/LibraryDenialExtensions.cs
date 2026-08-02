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
/// points for obtaining a sharing-library document: each fetches by <c>ExternalId</c> alone
/// (never owner-scoped — owner-scoping the lookup filter collapses readable-but-not-owned into
/// a 404, which is the exact bug this type exists to prevent) and then runs the matching guard
/// before ever handing the document back. A consumer that only ever calls one of these two
/// methods cannot obtain a document without having already passed the guard — there is no
/// second, unguarded fetch exposed by this contract for a consumer to reach for by mistake.
/// <see cref="TryDenyReadAsync"/> and <see cref="TryDenyWriteAsync"/> remain public for the rare
/// case a consumer already has the document via some other guarded path, but ordinary sharing-
/// library endpoints should call the <c>Load*OrRespondAsync</c> helpers and never fetch by
/// <c>ExternalId</c> directly.
/// </para>
/// <para>
/// <b>General ordering rule — read this before adding any check on the fetched document.</b> Any
/// endpoint-specific check that reads a fact off the fetched document — a status/state-machine
/// guard (e.g. <c>TrainingPlanStatus.Archived</c>), a completion guard (e.g.
/// <c>SESSION_ALREADY_COMPLETED</c>), a lock guard (e.g. <c>session_locked</c>), or any other
/// business-rule condition — MUST run <i>after</i> the denial check
/// (<see cref="TryDenyReadAsync"/>/<see cref="TryDenyWriteAsync"/>, or the guard embedded in the
/// <c>Load*OrRespondAsync</c> helpers), never before. A check placed ahead of the denial hands a
/// non-owner probing another owner's Private entry a response derived from that entry's internal
/// state (e.g. a 409 "already archived") before the caller has been confirmed to have any right
/// to know the entry exists at all — existence disclosed via a side channel the 404/403 pinning
/// above does not cover. The specific instance of this rule this codebase has already hit is
/// composing with <see cref="PlanConcurrencyGuard"/>, below.
/// </para>
/// <para>
/// <b>Ordering when composed with <see cref="PlanConcurrencyGuard"/>:</b> a write endpoint MUST
/// call <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/> and return immediately on a
/// <c>null</c> result, <i>before</i> ever invoking
/// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>. Do not fold the
/// denial check into that guard's <c>mutate</c> delegate — the guard evaluates
/// <c>VersionConflict</c> (a 409) before it ever calls <c>mutate</c>, so a denial check placed
/// there is unreachable until after a 409 has already been decided, and a non-owner probing
/// another owner's Private entry with a wrong version would get a 409 instead of the mandated
/// 404 — disclosing existence. See <see cref="LoadLibraryEntryForWriteOrRespondAsync{TDoc}"/>'s
/// own remarks for the exact composition.
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
    /// each child endpoint invents its own body for. Unlike <see cref="SendLibraryNotFoundAsync"/>,
    /// this does not take a <see cref="LibraryDenial"/>: a version conflict has exactly one call
    /// site per operation (there is no second, independently-written "genuinely missing" leg to
    /// keep in sync with), so a plain code/detail pair carries no divergence risk. Does NOT throw
    /// — the caller must return after this call.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="versionConflictErrorCode">The library-specific <c>*_VERSION_CONFLICT</c> error code.</param>
    /// <param name="versionConflictDetail">Human-readable detail for the 409 Problem Details body.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task SendLibraryVersionConflictAsync(
        this IEndpoint endpoint,
        string versionConflictErrorCode,
        string versionConflictDetail,
        CancellationToken ct) =>
        await endpoint.SendProblemAsync(409, versionConflictErrorCode, versionConflictDetail, ct);

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
        where TDoc : ILibraryDocument
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
    /// <para>
    /// <b>Call this — and act on a <c>null</c> result — before ever invoking
    /// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>.</b> The guard
    /// evaluates <c>VersionConflict</c> before its <c>mutate</c> delegate runs, so a denial
    /// check placed inside <c>mutate</c> is only reached after a 409 has already been decided.
    /// The safe composition for a version-gated sharing-library write endpoint is:
    /// </para>
    /// <code>
    /// var doc = await this.LoadLibraryEntryForWriteOrRespondAsync(
    ///     collection, req.EntryId, callerId, MealTemplateDenial, ct);
    /// if (doc is null)
    /// {
    ///     return; // 404 or 403 already written — caller is confirmed denied.
    /// }
    ///
    /// // Only a confirmed owner reaches here — a VersionConflict/ReplaceConflict 409 below
    /// // cannot leak existence, because the caller already knows this entry exists and is
    /// // theirs.
    /// var result = await guard.ReplaceWithVersionGuardAsync(
    ///     collection, lookupFilter, replaceFilter, req.Version, d => d.Version,
    ///     (entry, token) => MutateAsync(entry, req), ct);
    /// </code>
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
        where TDoc : ILibraryDocument
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

    private static async Task<TDoc?> FetchByExternalIdAsync<TDoc>(
        IMongoCollection<TDoc> collection,
        Guid externalId,
        CancellationToken ct)
        where TDoc : ILibraryDocument
    {
        var cursor = await collection.FindAsync(
            Builders<TDoc>.Filter.Eq(d => d.ExternalId, externalId), cancellationToken: ct);
        return await cursor.FirstOrDefaultAsync(ct);
    }
}
