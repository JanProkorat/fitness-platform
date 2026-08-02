namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Controls who can read a sharing-library entry (meal, session, nutrition-plan, or
/// training-plan template) besides its owner. Every consuming document stores this as a
/// string via <c>[BsonRepresentation(BsonType.String)]</c> on the property, so a seeded or
/// legacy value keeps deserializing correctly regardless of this enum's numeric order.
/// </summary>
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
