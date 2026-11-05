namespace FormUp.Application.Domain.Enums;

/// <summary>
/// How one meal item differs between what the client ate and the coach's current meal.
/// </summary>
public enum MealItemConflictTag
{
    /// <summary>The item is in both versions but its amount or nutrients differ.</summary>
    Changed,

    /// <summary>The coach's meal has the item; the client never saw it.</summary>
    Added,

    /// <summary>The client ate the item; the coach's meal no longer has it.</summary>
    Removed
}
