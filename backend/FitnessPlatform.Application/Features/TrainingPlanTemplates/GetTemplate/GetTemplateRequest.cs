namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.GetTemplate;

/// <summary>
/// Request to fetch a single training plan template's full detail.
/// </summary>
public class GetTemplateRequest
{
    /// <summary>
    /// The template's public identifier (route parameter).
    /// </summary>
    public Guid TemplateId { get; set; }
}
