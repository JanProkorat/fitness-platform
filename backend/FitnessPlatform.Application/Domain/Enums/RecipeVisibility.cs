namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Controls who can see a recipe.
/// </summary>
public enum RecipeVisibility
{
    /// <summary>
    /// Visible to all nutritionists.
    /// </summary>
    Public = 0,

    /// <summary>
    /// Only the owning nutritionist can see the recipe.
    /// </summary>
    Private = 1
}
