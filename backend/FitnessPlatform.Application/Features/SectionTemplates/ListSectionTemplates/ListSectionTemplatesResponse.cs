using FitnessPlatform.Application.Features.SectionTemplates.Shared;

namespace FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;

/// <summary>
/// Response wrapper for listing section templates: the calling trainer's own templates
/// (paginated) plus the public workout template library (unpaginated — currently 10 seeded
/// templates, embedded in full).
/// </summary>
public class ListSectionTemplatesResponse
{
    /// <summary>The calling trainer's own section templates, paginated (unchanged shape/semantics).</summary>
    public List<SectionTemplateResponse> OwnTemplates { get; set; } = [];

    /// <summary>Public workout templates available to all trainers, returned in full.</summary>
    public List<PublicWorkoutTemplateResponse> PublicWorkoutTemplates { get; set; } = [];
}
