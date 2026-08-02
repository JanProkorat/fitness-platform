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
/// Callers must look the document up by <c>ExternalId</c> alone — never owner-scoped in the
/// Mongo lookup filter — and pass the fetched document's <c>OwnerId</c>/<c>Visibility</c> here
/// so these methods can decide the outcome. Owner-scoping the lookup filter collapses
/// readable-but-not-owned into a 404, which is the exact bug this type exists to prevent.
/// </remarks>
public static class LibraryDenialExtensions
{
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

        await endpoint.SendProblemAsync(404, notFoundErrorCode, notFoundDetail, ct);
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
            await endpoint.SendProblemAsync(404, notFoundErrorCode, notFoundDetail, ct);
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
