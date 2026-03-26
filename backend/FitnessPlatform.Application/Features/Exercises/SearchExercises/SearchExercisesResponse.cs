using FitnessPlatform.Application.Features.Exercises.Shared;

namespace FitnessPlatform.Application.Features.Exercises.SearchExercises;

/// <summary>
/// Response model for exercise search results.
/// </summary>
public class SearchExercisesResponse
{
    /// <summary>
    /// List of matching exercises.
    /// </summary>
    public List<ExerciseSummary> Exercises { get; set; } = [];

    /// <summary>
    /// Total number of matching exercises.
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
