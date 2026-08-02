using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Endpoint-facing 404/403 responses for the four sharing-library features (meal, session,
/// nutrition-plan, training-plan templates), built on top of <see cref="LibraryAccessGuard"/>'s
/// pure predicates. Centralizes the two distinct denial outcomes so no consuming endpoint
/// accidentally leaks another owner's Private entry via a 403 (id enumeration) or produces a
/// 404 where a 403 is required.
/// </summary>
/// <remarks>
/// <para>
/// Callers must look the document up by <c>ExternalId</c> alone — never owner-scoped in the
/// Mongo lookup filter — and pass the fetched document's <c>OwnerId</c>/<c>Visibility</c> here
/// so these methods can decide the outcome. Owner-scoping the lookup filter collapses
/// readable-but-not-owned into a 404, which is the exact bug this type exists to prevent.
/// </para>
/// <para>
/// <b>Ordering when composed with <see cref="PlanConcurrencyGuard"/>:</b> a write endpoint MUST
/// call <see cref="TryDenyWriteAsync"/> on the freshly fetched document and return immediately
/// if it denies, <i>before</i> ever invoking
/// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>. Do not fold the
/// denial check into that guard's <c>mutate</c> delegate — the guard evaluates
/// <c>VersionConflict</c> (a 409) before it ever calls <c>mutate</c>, so a denial check placed
/// there is unreachable until after a 409 has already been decided, and a non-owner probing
/// another owner's Private entry with a wrong version would get a 409 instead of the mandated
/// 404 — disclosing existence. See <see cref="TryDenyWriteAsync"/>'s own remarks for the exact
/// composition.
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
    /// Every sharing-library endpoint MUST route <b>both</b> of its 404 paths through this
    /// method — including the "document does not exist at all" path. Do not call
    /// <c>Send.NotFoundAsync(ct)</c> (the repo's usual empty-bodied 404, e.g.
    /// <c>UpdatePlanEndpoint.cs</c>) for a sharing-library entry: that produces a structurally
    /// different response (no body, no <c>errorCode</c>) than the Problem Details body this
    /// method writes for the denied-read case, which is a one-request existence oracle.
    /// </remarks>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="notFoundErrorCode">The library-specific <c>*_NOT_FOUND</c> error code.</param>
    /// <param name="notFoundDetail">Human-readable detail for the 404 Problem Details body.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task SendLibraryNotFoundAsync(
        this IEndpoint endpoint,
        string notFoundErrorCode,
        string notFoundDetail,
        CancellationToken ct) =>
        await endpoint.SendProblemAsync(404, notFoundErrorCode, notFoundDetail, ct);

    /// <summary>
    /// Enforces read access for a library entry already fetched by <c>ExternalId</c> alone.
    /// Writes a 404 (<paramref name="notFoundErrorCode"/>) when the caller cannot read the
    /// entry (another owner's Private entry — indistinguishable from a missing entry, in
    /// body, headers, and timing). Returns <c>true</c> when the response was written and the
    /// endpoint must return immediately; <c>false</c> when the caller may proceed.
    /// </summary>
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="ownerId">The fetched entry's owner id.</param>
    /// <param name="visibility">The fetched entry's visibility.</param>
    /// <param name="notFoundErrorCode">The library-specific <c>*_NOT_FOUND</c> error code.</param>
    /// <param name="notFoundDetail">Human-readable detail for the 404 Problem Details body.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> TryDenyReadAsync(
        this IEndpoint endpoint,
        Guid callerId,
        Guid ownerId,
        LibraryVisibility visibility,
        string notFoundErrorCode,
        string notFoundDetail,
        CancellationToken ct)
    {
        if (LibraryAccessGuard.CanRead(callerId, ownerId, visibility))
        {
            return false;
        }

        await endpoint.SendLibraryNotFoundAsync(notFoundErrorCode, notFoundDetail, ct);
        return true;
    }

    /// <summary>
    /// Enforces write access for a library entry already fetched by <c>ExternalId</c> alone.
    /// Writes a 404 (<paramref name="notFoundErrorCode"/>) when the caller cannot even read
    /// the entry (another owner's Private entry), or a 403
    /// (<paramref name="notOwnedErrorCode"/>) when the caller can read it but does not own it
    /// (another owner's Public entry). Returns <c>true</c> when a response was written and the
    /// endpoint must return immediately; <c>false</c> when the caller may proceed to
    /// mutate/persist.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Call this — and act on a <c>true</c> result — before ever invoking
    /// <see cref="PlanConcurrencyGuard.ReplaceWithVersionGuardAsync{TDoc}"/>.</b> The guard
    /// evaluates <c>VersionConflict</c> before its <c>mutate</c> delegate runs, so a denial
    /// check placed inside <c>mutate</c> is only reached after a 409 has already been decided.
    /// The safe composition for a version-gated sharing-library write endpoint is:
    /// </para>
    /// <code>
    /// var doc = await FetchByExternalIdAsync(req.EntryId, ct); // ExternalId-only filter
    /// if (doc is null)
    /// {
    ///     await this.SendLibraryNotFoundAsync(ErrorCodes.MealTemplate.NotFound, "...", ct);
    ///     return;
    /// }
    ///
    /// if (await this.TryDenyWriteAsync(
    ///     callerId, doc.OwnerId, doc.Visibility,
    ///     ErrorCodes.MealTemplate.NotFound, "...",
    ///     ErrorCodes.MealTemplate.NotOwned, "...", ct))
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
    /// <param name="endpoint">The endpoint instance.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="ownerId">The fetched entry's owner id.</param>
    /// <param name="visibility">The fetched entry's visibility.</param>
    /// <param name="notFoundErrorCode">The library-specific <c>*_NOT_FOUND</c> error code.</param>
    /// <param name="notFoundDetail">Human-readable detail for the 404 Problem Details body.</param>
    /// <param name="notOwnedErrorCode">The library-specific <c>*_NOT_OWNED</c> error code.</param>
    /// <param name="notOwnedDetail">Human-readable detail for the 403 Problem Details body.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<bool> TryDenyWriteAsync(
        this IEndpoint endpoint,
        Guid callerId,
        Guid ownerId,
        LibraryVisibility visibility,
        string notFoundErrorCode,
        string notFoundDetail,
        string notOwnedErrorCode,
        string notOwnedDetail,
        CancellationToken ct)
    {
        if (!LibraryAccessGuard.CanRead(callerId, ownerId, visibility))
        {
            await endpoint.SendLibraryNotFoundAsync(notFoundErrorCode, notFoundDetail, ct);
            return true;
        }

        if (!LibraryAccessGuard.CanWrite(callerId, ownerId))
        {
            await endpoint.SendProblemAsync(403, notOwnedErrorCode, notOwnedDetail, ct);
            return true;
        }

        return false;
    }
}
