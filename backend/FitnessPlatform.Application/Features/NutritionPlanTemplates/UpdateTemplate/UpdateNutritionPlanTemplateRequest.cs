using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.UpdateTemplate;

/// <summary>
/// Request for a full-state update of a nutrition plan template: replaces name, description,
/// goal/dietary style, settings, week tree, and supplements.
/// </summary>
public class UpdateNutritionPlanTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated free-text description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Updated primary fitness goal.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Updated dietary style.
    /// </summary>
    public DietaryStyle? DietaryStyle { get; set; }

    /// <summary>
    /// Updated global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Full week structure to persist. Replaces all existing weeks, days, meals, foods, and
    /// recipes.
    /// </summary>
    public List<NutritionPlanTemplateWeekRequest> Weeks { get; set; } = [];

    /// <summary>
    /// Full supplement list to persist. Replaces all existing supplements.
    /// </summary>
    public List<TemplateSupplementRequest> Supplements { get; set; } = [];

    /// <summary>
    /// Expected version for optimistic concurrency control.
    /// </summary>
    public int Version { get; set; }
}
