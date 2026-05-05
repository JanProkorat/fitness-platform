namespace FitnessPlatform.Application.Features.SectionTemplates.ListSectionTemplates;

/// <summary>
/// Request for listing the calling trainer's section templates.
/// </summary>
public class ListSectionTemplatesRequest
{
    /// <summary>Page number (1-based). Defaults to 1.</summary>
    public int Page { get; set; } = 1;

    /// <summary>Page size. Defaults to 50.</summary>
    public int PageSize { get; set; } = 50;
}
