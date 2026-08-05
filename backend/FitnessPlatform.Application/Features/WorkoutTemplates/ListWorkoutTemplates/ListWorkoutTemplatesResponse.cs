using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;

/// <summary>
/// Response wrapper for listing workout templates: the calling trainer's own templates,
/// paginated. Session templates now have their own paginated search endpoint under
/// <c>/training/session-templates</c> — see <c>SearchSessionTemplatesEndpoint</c>.
/// </summary>
public class ListWorkoutTemplatesResponse
{
    /// <summary>The calling trainer's own workout templates, paginated (unchanged shape/semantics).</summary>
    public List<WorkoutTemplateResponse> OwnTemplates { get; set; } = [];
}
