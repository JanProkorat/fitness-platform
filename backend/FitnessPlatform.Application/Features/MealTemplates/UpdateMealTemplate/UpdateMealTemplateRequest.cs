using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.MealTemplates.UpdateMealTemplate;

/// <summary>
/// Request model for updating an existing meal template.
/// </summary>
public class UpdateMealTemplateRequest
{
    /// <summary>
    /// Public identifier of the meal template to update.
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Updated meal-slot hint — not a constraint.
    /// </summary>
    public MealKind? Kind { get; set; }

    /// <summary>
    /// Updated foods — the existing <see cref="MealFood"/> snapshot shape, verbatim.
    /// </summary>
    public List<MealFood> Foods { get; set; } = [];

    /// <summary>
    /// Updated recipes — the existing <see cref="MealRecipe"/> snapshot shape, verbatim.
    /// </summary>
    public List<MealRecipe> Recipes { get; set; } = [];

    /// <summary>
    /// Updated visibility.
    /// </summary>
    public LibraryVisibility Visibility { get; set; }

    /// <summary>
    /// The version the caller last read. Used for optimistic-concurrency CAS; a stale value
    /// returns <c>409</c>.
    /// </summary>
    public int Version { get; set; }
}
