namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CopyTemplate;

/// <summary>
/// Request for copying a training plan template.
/// </summary>
public class CopyTrainingPlanTemplateRequest
{
    /// <summary>Route parameter — public id of the template to copy.</summary>
    public Guid TemplateId { get; set; }
}
