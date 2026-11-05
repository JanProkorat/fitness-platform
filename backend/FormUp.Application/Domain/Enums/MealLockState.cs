namespace FormUp.Application.Domain.Enums;

/// <summary>
/// Why a plan meal can or cannot be edited by the coach.
/// </summary>
public enum MealLockState
{
    /// <summary>The meal is on today or a future day and nothing of it is eaten: editable.</summary>
    Open,

    /// <summary>Every item of the meal is eaten: locked.</summary>
    Eaten,

    /// <summary>Some, not every, item of the meal is eaten: locked.</summary>
    PartlyEaten,

    /// <summary>The meal's day is before the client's local today and nothing of it was eaten: locked.</summary>
    Missed
}
