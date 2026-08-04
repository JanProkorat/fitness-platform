using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.MealTemplates.Shared;

/// <summary>
/// Full meal template detail returned by get, create, update, copy, and from-plan endpoints.
/// </summary>
public class MealTemplateDetailResponse
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
    /// Foods in this meal — the same snapshot shape used inside a nutrition plan, so this
    /// response can be dropped directly into an <c>UpdatePlan</c> request's meal.
    /// </summary>
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Recipes in this meal — the same snapshot shape used inside a nutrition plan.
    /// </summary>
    public List<MealRecipe> Recipes { get; set; } = [];

    /// <summary>
    /// Server-computed total macronutrients across <see cref="Foods"/> and <see cref="Recipes"/>.
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
    /// When the template was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version, required on <c>PUT</c> requests.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// Maps a <see cref="MealTemplate"/> document to a <see cref="MealTemplateDetailResponse"/>.
    /// </summary>
    /// <param name="template">The source meal template document.</param>
    /// <param name="currentUserId">Id of the authenticated caller.</param>
    /// <returns>A full detail response.</returns>
    public static MealTemplateDetailResponse FromDocument(MealTemplate template, Guid currentUserId) => new()
    {
        TemplateId = template.ExternalId,
        Name = template.Name,
        Description = template.Description,
        Kind = template.Kind,
        Foods = template.Foods,
        Recipes = template.Recipes,
        TotalNutrients = template.TotalNutrients,
        Visibility = template.Visibility,
        IsOwnedByCurrentUser = template.OwnerId == currentUserId,
        DateCreated = template.DateCreated,
        DateUpdated = template.DateUpdated,
        Version = template.Version
    };
}
