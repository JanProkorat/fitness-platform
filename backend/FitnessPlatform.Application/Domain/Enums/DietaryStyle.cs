namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Dietary style or eating pattern preference.
/// </summary>
public enum DietaryStyle
{
    /// <summary>
    /// No specific dietary restrictions; standard omnivore diet.
    /// </summary>
    Standard,

    /// <summary>
    /// Vegetarian diet; excludes meat and fish but may include dairy and eggs.
    /// </summary>
    Vegetarian,

    /// <summary>
    /// Vegan diet; excludes all animal products.
    /// </summary>
    Vegan,

    /// <summary>
    /// Gluten-free diet; excludes wheat, barley, and rye.
    /// </summary>
    GlutenFree
}
