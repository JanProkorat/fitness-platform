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
/// <b>Flag for #860:</b> the current <c>WorkoutTemplate.Visibility</c> property is typed
/// <c>WorkoutTemplateVisibility</c> with a <c>= WorkoutTemplateVisibility.Public</c> initializer.
/// If a future change retypes that property (or an equivalent, e.g. a renamed
/// <c>SessionTemplate</c>) to this <see cref="LibraryVisibility"/> and drops the explicit
/// initializer to match the pattern documents here use, the default for newly created documents
/// silently flips from Public to Private — because <see cref="Private"/> is this enum's CLR
/// default, not <c>WorkoutTemplateVisibility</c>'s. That flip may be exactly what the new
/// sharing model wants, but it changes existing behavior and must be called out explicitly in
/// whichever PR performs the retype, not discovered later as a regression.
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
