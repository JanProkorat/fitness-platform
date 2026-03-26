using FitnessPlatform.Application.Features.Exercises.Shared;

namespace FitnessPlatform.Application.Features.Exercises.GetCustomExercises;

/// <summary>
/// Response model for custom exercise listing.
/// </summary>
public class GetCustomExercisesResponse
{
    /// <summary>
    /// List of custom exercises.
    /// </summary>
    public List<ExerciseSummary> Exercises { get; set; } = [];

    /// <summary>
    /// Total number of custom exercises.
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
