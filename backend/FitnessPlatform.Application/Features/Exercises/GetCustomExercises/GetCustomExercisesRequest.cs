namespace FitnessPlatform.Application.Features.Exercises.GetCustomExercises;

/// <summary>
/// Request model for retrieving custom exercises.
/// </summary>
public class GetCustomExercisesRequest
{
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
