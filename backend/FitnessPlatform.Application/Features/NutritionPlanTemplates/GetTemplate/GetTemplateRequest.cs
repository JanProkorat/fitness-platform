namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.GetTemplate;

/// <summary>
/// Request to fetch a single nutrition plan template's full detail.
/// </summary>
public class GetTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }
}
