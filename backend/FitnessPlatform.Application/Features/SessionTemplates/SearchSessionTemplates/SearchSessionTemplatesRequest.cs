using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.SessionTemplates.SearchSessionTemplates;

/// <summary>
/// Request model for searching session templates.
/// </summary>
public class SearchSessionTemplatesRequest
{
    /// <summary>
    /// Optional search term to filter templates by name.
    /// </summary>
    [BindFrom("search")]
    public string? Search { get; set; }

    /// <summary>
    /// Optional difficulty filter.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// Optional maximum estimated duration in minutes (inclusive).
    /// </summary>
    public int? MaxEstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
