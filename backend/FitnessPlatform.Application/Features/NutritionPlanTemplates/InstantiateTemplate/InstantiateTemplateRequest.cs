namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.InstantiateTemplate;

/// <summary>
/// Request to instantiate a nutrition plan template into a new Draft client plan.
/// </summary>
public class InstantiateTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }

    /// <summary>
    /// The target client's <c>ClientProfile.PublicId</c> — the trainer-facing identifier, not
    /// the internal <c>ApplicationUser.Id</c> storage key.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Display name for the new plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional start date. Must be a Monday and not in the past.
    /// </summary>
    public DateTime? StartDate { get; set; }
}
