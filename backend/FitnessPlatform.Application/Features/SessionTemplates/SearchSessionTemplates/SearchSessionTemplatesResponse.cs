using FitnessPlatform.Application.Features.SessionTemplates.Shared;

namespace FitnessPlatform.Application.Features.SessionTemplates.SearchSessionTemplates;

/// <summary>
/// Paginated response for session template search results.
/// </summary>
public class SearchSessionTemplatesResponse
{
    /// <summary>
    /// List of matching session templates.
    /// </summary>
    public List<SessionTemplateSummaryDto> Templates { get; set; } = [];

    /// <summary>
    /// Total number of matching templates.
    /// </summary>
    public long TotalCount { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; }
}
