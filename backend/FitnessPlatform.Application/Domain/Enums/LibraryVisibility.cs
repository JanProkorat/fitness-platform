namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Controls who can read a sharing-library entry (meal, session, nutrition-plan, or
/// training-plan template) besides its owner. Every consuming document stores this as a
/// string via <c>[BsonRepresentation(BsonType.String)]</c> on the property, so a seeded or
/// legacy value keeps deserializing correctly regardless of this enum's numeric order.
/// </summary>
/// <remarks>
/// <para>
/// <b>This enum's numeric order is deliberately inverted relative to the repo's three existing
/// visibility enums.</b> <c>WorkoutTemplateVisibility</c>, <c>RecipeVisibility</c>, and
/// <c>FoodVisibility</c> all declare <c>Public = 0</c> / <c>Private = 1</c>; this enum declares
/// <c>Private = 0</c> / <c>Public = 1</c>. That is intentional (see <see cref="Private"/>'s own
/// remarks — private-by-default is the safe fallback for a field-absent document) and not a
/// mistake to "fix" into consistency with the other three later.
/// </para>
/// <para>
/// <b>#860 (post-#857 terms):</b> #857 renamed the pre-existing <c>WorkoutTemplate</c> document
/// to <c>SessionTemplate</c> and minted a distinct, new <c>WorkoutTemplate</c> document with no
/// visibility field of its own — that new document is unrelated to this note. #860 retyped
/// <c>SessionTemplate.Visibility</c> from the now-deleted <c>WorkoutTemplateVisibility</c> to
/// this <see cref="LibraryVisibility"/> and dropped the explicit
/// <c>= WorkoutTemplateVisibility.Public</c> initializer to match the pattern documents here
/// use. That flip means a newly created <c>SessionTemplate</c> now defaults to Private —
/// <see cref="Private"/> is this enum's CLR default — rather than the previous Public default;
/// the already-seeded catalog documents store <c>"Public"</c> explicitly, so they are
/// unaffected by the retype.
/// </para>
/// </remarks>
public enum LibraryVisibility
{
    /// <summary>
    /// Visible only to its owner. This is the CLR default (0) and — for a new-library
    /// document whose <c>Visibility</c> property carries no initializer — also what a
    /// field-absent document deserializes to. Private-by-default is the safe choice when
    /// the field is missing.
    /// </summary>
    Private = 0,

    /// <summary>
    /// Visible to every user with read access to the library, not just the owner.
    /// </summary>
    Public = 1
}
