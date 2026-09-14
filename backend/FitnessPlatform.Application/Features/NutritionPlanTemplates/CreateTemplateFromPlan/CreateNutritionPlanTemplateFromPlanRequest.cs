using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplateFromPlan;

/// <summary>
/// Request to save an existing nutrition plan as a new template.
/// </summary>
public class CreateNutritionPlanTemplateFromPlanRequest
{
    /// <summary>
    /// The source plan's public identifier (<c>NutritionPlan.ExternalId</c> — NOT the client's
    /// <c>ClientProfile.PublicId</c>).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Display name for the new template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional free-text description for the new template.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Who can read the new template besides the caller. Defaults to <see cref="LibraryVisibility.Private"/>.
    /// </summary>
    public LibraryVisibility Visibility { get; set; } = LibraryVisibility.Private;
}
