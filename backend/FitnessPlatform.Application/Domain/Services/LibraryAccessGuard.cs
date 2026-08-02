using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Pure ownership/visibility predicates shared by the four sharing-library features (meal,
/// session, nutrition-plan, and training-plan templates). See
/// <see cref="Extensions.LibraryDenialExtensions"/> for the endpoint-facing 404/403 responses
/// built on top of these predicates.
/// </summary>
/// <remarks>
/// Read and write are deliberately two separate predicates, because collapsing them into one
/// "owner or public" check leaks the existence of another owner's Private entry: a write
/// attempt against a document the caller cannot even read must be indistinguishable from a
/// missing document (404), while a write attempt against a document the caller can read but
/// does not own must be a distinct 403 (id enumeration otherwise). See
/// <see cref="Extensions.LibraryDenialExtensions.TryDenyWriteAsync"/> for how the two
/// predicates combine into that outcome.
/// </remarks>
public static class LibraryAccessGuard
{
    /// <summary>
    /// Whether <paramref name="callerId"/> may read an entry owned by
    /// <paramref name="ownerId"/> with the given <paramref name="visibility"/>: the owner
    /// always can, and everyone can read a <see cref="LibraryVisibility.Public"/> entry.
    /// </summary>
    public static bool CanRead(Guid callerId, Guid ownerId, LibraryVisibility visibility) =>
        callerId == ownerId || visibility == LibraryVisibility.Public;

    /// <summary>
    /// Whether <paramref name="callerId"/> may write (update/delete) an entry owned by
    /// <paramref name="ownerId"/>. Write access never depends on visibility — only the owner
    /// may write, regardless of whether the entry is Public or Private.
    /// </summary>
    public static bool CanWrite(Guid callerId, Guid ownerId) =>
        callerId == ownerId;
}
