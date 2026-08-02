using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Pure ownership/visibility predicates shared by the four sharing-library features (meal,
/// session, nutrition-plan, and training-plan templates). See
/// <see cref="Extensions.LibraryDenialExtensions"/> for the endpoint-facing 404/403 responses
/// built on top of these predicates.
/// </summary>
/// <remarks>
/// <para>
/// Read and write are deliberately two separate predicates, because collapsing them into one
/// "owner or public" check leaks the existence of another owner's Private entry: a write
/// attempt against a document the caller cannot even read must be indistinguishable from a
/// missing document (404), while a write attempt against a document the caller can read but
/// does not own must be a distinct 403 (id enumeration otherwise). See
/// <see cref="Extensions.LibraryDenialExtensions.TryDenyWriteAsync"/> for how the two
/// predicates combine into that outcome.
/// </para>
/// <para>
/// <b>Role authorization is the endpoint's precondition — this guard does not supply it.</b>
/// <see cref="CanRead"/> returns <c>true</c> for <i>any</i> caller on a
/// <see cref="LibraryVisibility.Public"/> entry, by design — it only decides ownership/
/// visibility, never who is allowed to call the endpoint in the first place. Every sharing-
/// library endpoint MUST carry its own role policy per the spec (<c>Nutritionist</c> for meal
/// and nutrition-plan templates; <c>Trainer</c> for session and training-plan templates) via
/// FastEndpoints' <c>Policies(...)</c>/<c>Roles(...)</c> in <c>Configure()</c>. An endpoint that
/// omits this lets any authenticated client-role user enumerate and read every coach's public
/// templates, and the resulting 403-from-role-check then confirms the endpoint's existence to
/// them — a distinct disclosure from the 404/403 pinning above, which this guard cannot close
/// because it never sees the caller's role. This is also the answer to the cross-role question:
/// a Trainer cannot read a Nutritionist's meal templates because the meal-template endpoint is
/// role-gated to <c>Nutritionist</c> callers, not because <see cref="CanRead"/> encodes any
/// notion of role — it doesn't, and shouldn't.
/// </para>
/// </remarks>
public static class LibraryAccessGuard
{
    /// <summary>
    /// Whether <paramref name="callerId"/> may read an entry owned by
    /// <paramref name="ownerId"/> with the given <paramref name="visibility"/>: the owner
    /// always can, and everyone can read a <see cref="LibraryVisibility.Public"/> entry.
    /// </summary>
    /// <remarks>
    /// The ownership comparison also requires <paramref name="callerId"/> to be non-empty. A
    /// document whose <c>ownerId</c> field is absent deserializes to <see cref="Guid.Empty"/>
    /// (this repo has been bitten by this exact field-absent-deserializes-to-default shape
    /// before, on a Mongo document's <c>Version</c> field) — without this guard, a caller whose
    /// id also resolved to <see cref="Guid.Empty"/> (e.g. an upstream auth bug that defaults an
    /// unresolved claim to the CLR default instead of rejecting the request) would incorrectly
    /// own every such document.
    /// </remarks>
    public static bool CanRead(Guid callerId, Guid ownerId, LibraryVisibility visibility) =>
        (callerId != Guid.Empty && callerId == ownerId) || visibility == LibraryVisibility.Public;

    /// <summary>
    /// Whether <paramref name="callerId"/> may write (update/delete) an entry owned by
    /// <paramref name="ownerId"/>. Write access never depends on visibility — only the owner
    /// may write, regardless of whether the entry is Public or Private.
    /// </summary>
    /// <remarks>See <see cref="CanRead"/>'s remarks — the same <see cref="Guid.Empty"/> guard applies here.</remarks>
    public static bool CanWrite(Guid callerId, Guid ownerId) =>
        callerId != Guid.Empty && callerId == ownerId;
}
