using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.MealTemplates.CreateMealTemplate;

/// <summary>
/// Request model for creating a new meal template.
/// </summary>
public class CreateMealTemplateRequest
{
    /// <summary>
    /// Display name of the saved meal.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional hint for which meal slot this template suits — not a constraint.
    /// </summary>
    public MealKind? Kind { get; set; }

    /// <summary>
    /// Foods to include — the existing <see cref="MealFood"/> snapshot shape, verbatim.
    /// </summary>
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Recipes to include — the existing <see cref="MealRecipe"/> snapshot shape, verbatim.
    /// </summary>
    public List<MealRecipe> Recipes { get; set; } = [];

    /// <summary>
    /// Who can read this template besides the caller. Defaults to
    /// <see cref="LibraryVisibility.Private"/> when omitted.
    /// </summary>
    public LibraryVisibility Visibility { get; set; } = LibraryVisibility.Private;
}
