using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutTemplates.CreateWorkoutTemplate;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.UpdateWorkoutTemplate;

/// <summary>
/// Request for updating an existing workout template.
/// </summary>
public class UpdateWorkoutTemplateRequest
{
    /// <summary>The template's public identifier (route parameter).</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Updated display name of the template.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Updated optional coach notes describing the workout as a whole.</summary>
    public string? Notes { get; set; }

    /// <summary>Updated default workout format. Null means no format override.</summary>
    public WorkoutFormat? DefaultFormat { get; set; }

    /// <summary>Updated default format configuration.</summary>
    public WodConfig? DefaultFormatConfig { get; set; }

    /// <summary>Updated default exercises.</summary>
    public List<CreateWorkoutTemplateExerciseRequest> DefaultExercises { get; set; } = [];

    /// <summary>Expected version for optimistic concurrency control.</summary>
    public int Version { get; set; }
}
