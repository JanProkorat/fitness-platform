namespace FitnessPlatform.Application.Features.WorkoutTemplates.GetWorkoutTemplate;

/// <summary>
/// Request for retrieving a single section template by its public identifier.
/// </summary>
public class GetWorkoutTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }
}
