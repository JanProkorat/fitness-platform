using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.MealTemplates.SaveMealTemplateFromPlan;

/// <summary>
/// Request model for saving a meal template from an existing nutrition plan meal.
/// </summary>
public class SaveMealTemplateFromPlanRequest
{
    /// <summary>
    /// The source nutrition plan's public identifier (<c>NutritionPlan.ExternalId</c>) — not
    /// the client id.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The week number (1-based) within the plan that contains the source meal.
    /// </summary>
    public int WeekNumber { get; set; }

    /// <summary>
    /// The day of week (1 = Monday … 7 = Sunday) within the week that contains the source meal.
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Identifier of the source <c>PlanMeal</c> within the addressed day.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Display name for the new template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description for the new template.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Who can read the new template besides the caller.
    /// </summary>
    public LibraryVisibility Visibility { get; set; } = LibraryVisibility.Private;
}
