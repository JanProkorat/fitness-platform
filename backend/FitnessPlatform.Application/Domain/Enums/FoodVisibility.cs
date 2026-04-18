namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Controls who can see a custom food item.
/// </summary>
public enum FoodVisibility
{
    /// <summary>
    /// Visible to all nutritionists.
    /// </summary>
    Public = 0,

    /// <summary>
    /// Visible only to the nutritionist who created it.
    /// </summary>
    Private = 1
}
