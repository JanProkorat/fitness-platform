namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.DeleteTemplate;

/// <summary>
/// Request to delete a nutrition plan template.
/// </summary>
public class DeleteTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }
}
