namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.InstantiateTemplate;

/// <summary>
/// Response describing the new client plan created by instantiating a template.
/// </summary>
public class InstantiateTemplateResponse
{
    /// <summary>
    /// The newly created plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The client's <c>ClientProfile.PublicId</c> — echoes the caller-supplied value.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Display name of the new plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Status of the new plan — always <c>Draft</c> immediately after instantiation.
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// When the new plan was created.
    /// </summary>
    public DateTime DateCreated { get; set; }
}
