namespace FitnessPlatform.Application.Features.WorkoutTemplates.DeleteWorkoutTemplate;

/// <summary>
/// Request for deleting a workout template.
/// </summary>
public class DeleteWorkoutTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }
}
