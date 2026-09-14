using FastEndpoints;

namespace FitnessPlatform.Application.Features.MealTemplates.SearchMealTemplates;

/// <summary>
/// Request model for searching meal templates.
/// </summary>
public class SearchMealTemplatesRequest
{
    /// <summary>
    /// Optional search term to filter templates by name.
    /// </summary>
    [BindFrom("search")]
    public string? Search { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
