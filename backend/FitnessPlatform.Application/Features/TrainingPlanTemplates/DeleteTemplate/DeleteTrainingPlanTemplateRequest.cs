namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.DeleteTemplate;

/// <summary>
/// Request for deleting a training plan template.
/// </summary>
public class DeleteTrainingPlanTemplateRequest
{
    /// <summary>Route parameter — public id of the template to delete.</summary>
    public Guid TemplateId { get; set; }
}
