namespace FitnessPlatform.Application.Domain.Extensions;

/// <summary>
/// Pins the denial strings for one sharing-library feature (meal, session, nutrition-plan, or
/// training-plan templates) into a single value, so a consuming endpoint cannot pass a
/// different <see cref="NotFoundDetail"/> (or <see cref="NotFoundErrorCode"/>) to its own
/// "document does not exist" branch than the one it passes to
/// <see cref="LibraryDenialExtensions.TryDenyReadAsync"/> /
/// <see cref="LibraryDenialExtensions.TryDenyWriteAsync"/>. Before this type existed, those two
/// call sites each took four independent <c>string</c> parameters — nothing stopped a typo or a
/// copy-paste slip from making the two legs diverge, which would produce two distinguishable 404
/// bodies and reopen the existence oracle this contract exists to close. It also closes a second
/// hazard: <c>TryDenyWriteAsync</c> used to take four adjacent <c>string</c> parameters
/// (notFound code, notFound detail, notOwned code, notOwned detail) in a row — transposing the
/// notFound/notOwned pair at a call site compiled silently and crossed the error codes clients
/// localize on. <see cref="VersionConflictErrorCode"/>/<see cref="VersionConflictDetail"/> close
/// the identical hazard for the 409 pair, previously two loose, adjacent parameters on
/// <c>LoadAndReplaceLibraryEntryWithVersionGuardAsync</c>. A single <see cref="LibraryDenial"/>
/// value removes all three hazards: there is exactly one place to declare the six strings. This
/// does not make a transposed <c>new(...)</c> call impossible to write — every parameter is
/// <c>string</c>, so a transposed constructor call still compiles — but it reduces the number of
/// sites where that mistake can occur from one per call site (N) to one per library (1), since
/// every call site for a library now shares the same pre-built value instead of re-typing the
/// six strings.
/// </summary>
/// <remarks>
/// Declare exactly one <c>static readonly</c> instance per library (e.g. one for meal templates,
/// one for session templates) and reuse it at every call site for that library — do not
/// construct a fresh <see cref="LibraryDenial"/> inline per call.
/// </remarks>
/// <param name="NotFoundErrorCode">The library's <c>*_NOT_FOUND</c> error code.</param>
/// <param name="NotFoundDetail">
/// The shared 404 Problem Details body text — used identically for a genuinely missing document
/// and for another owner's unreadable Private entry.
/// </param>
/// <param name="NotOwnedErrorCode">
/// The library's <c>*_NOT_OWNED</c> error code. Only read by
/// <see cref="LibraryDenialExtensions.TryDenyWriteAsync"/>. Every sharing-library mints all
/// three codes together at once (see <c>ErrorCodes</c>'s "Sharing Libraries" section) — there
/// is no read-only library to justify a placeholder value here.
/// </param>
/// <param name="NotOwnedDetail">
/// The 403 Problem Details body text for a readable-but-not-owned write attempt. Write-only, see
/// <see cref="NotOwnedErrorCode"/>.
/// </param>
/// <param name="VersionConflictErrorCode">
/// The library's <c>*_VERSION_CONFLICT</c> error code. Only read by
/// <see cref="LibraryDenialExtensions.SendLibraryVersionConflictAsync"/> and, internally, by
/// <see cref="LibraryDenialExtensions.LoadAndReplaceLibraryEntryWithVersionGuardAsync{TDoc}"/>.
/// </param>
/// <param name="VersionConflictDetail">
/// The 409 Problem Details body text for a stale-version or lost-replace-race conflict. See
/// <see cref="VersionConflictErrorCode"/>.
/// </param>
public readonly record struct LibraryDenial(
    string NotFoundErrorCode,
    string NotFoundDetail,
    string NotOwnedErrorCode,
    string NotOwnedDetail,
    string VersionConflictErrorCode,
    string VersionConflictDetail);
