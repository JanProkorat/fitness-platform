using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.MealTemplates.Shared;

/// <summary>
/// Lightweight meal template summary for search/list views.
/// </summary>
public class MealTemplateSummaryDto
{
    /// <summary>
    /// Public identifier of the meal template.
    /// </summary>
    public Guid TemplateId { get; set; }

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
    /// Number of foods in this template.
    /// </summary>
    public int FoodCount { get; set; }

    /// <summary>
    /// Number of recipes in this template.
    /// </summary>
    public int RecipeCount { get; set; }

    /// <summary>
    /// Server-computed total macronutrients.
    /// </summary>
    public NutrientTotals TotalNutrients { get; set; } = new();

    /// <summary>
    /// Who can read this template besides its owner.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// True when the authenticated caller is the nutritionist who owns this template.
    /// </summary>
    public bool IsOwnedByCurrentUser { get; set; }

    /// <summary>
    /// When the template was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Maps a <see cref="MealTemplate"/> document to a <see cref="MealTemplateSummaryDto"/>.
    /// </summary>
    /// <param name="template">The source meal template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    /// <returns>A summary DTO.</returns>
    public static MealTemplateSummaryDto FromDocument(MealTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        Description = template.Description,
        Kind = template.Kind,
        FoodCount = template.Foods.Count,
        RecipeCount = template.Recipes.Count,
        TotalNutrients = template.TotalNutrients,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        DateCreated = template.DateCreated
    };
}
