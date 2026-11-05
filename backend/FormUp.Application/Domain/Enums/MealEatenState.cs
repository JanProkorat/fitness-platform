namespace FormUp.Application.Domain.Enums;

/// <summary>
/// How much of a plan meal the client has eaten.
/// </summary>
public enum MealEatenState
{
    /// <summary>No item of the meal is eaten.</summary>
    NotEaten,

    /// <summary>Some, but not every, current item of the meal is eaten.</summary>
    PartlyEaten,

    /// <summary>Every current item of the meal is eaten.</summary>
    Eaten
}
