namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Meal a recipe is suited for. Stored on <c>Recipe.MealTypes</c> as the member names.
/// </summary>
public enum RecipeMealType
{
    /// <summary>Morning meal.</summary>
    Breakfast,

    /// <summary>Midday meal.</summary>
    Lunch,

    /// <summary>Evening meal.</summary>
    Dinner,

    /// <summary>Small meal between the main ones.</summary>
    Snack,

    /// <summary>Sweet course.</summary>
    Dessert
}
