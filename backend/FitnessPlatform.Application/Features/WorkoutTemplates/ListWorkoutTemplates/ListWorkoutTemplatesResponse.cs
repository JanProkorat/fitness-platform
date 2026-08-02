using FitnessPlatform.Application.Features.WorkoutTemplates.Shared;

namespace FitnessPlatform.Application.Features.WorkoutTemplates.ListWorkoutTemplates;

/// <summary>
/// Response wrapper for listing section templates: the calling trainer's own templates
/// (paginated) plus the public workout template library (unpaginated — currently 10 seeded
/// templates, embedded in full).
/// </summary>
public class ListWorkoutTemplatesResponse
{
    /// <summary>The calling trainer's own section templates, paginated (unchanged shape/semantics).</summary>
    public List<WorkoutTemplateResponse> OwnTemplates { get; set; } = [];

    /// <summary>Public workout templates available to all trainers, returned in full.</summary>
    public List<PublicSessionTemplateResponse> PublicSessionTemplates { get; set; } = [];
}
