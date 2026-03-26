using FastEndpoints;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Exercises.SearchExercises;

/// <summary>
/// Request model for searching exercises.
/// </summary>
public class SearchExercisesRequest
{
    /// <summary>
    /// Free-text search query.
    /// </summary>
    [BindFrom("q")]
    public string? Query { get; set; }

    /// <summary>
    /// Filter by muscle group.
    /// </summary>
    public MuscleGroup? MuscleGroup { get; set; }

    /// <summary>
    /// Filter by equipment type.
    /// </summary>
    public ExerciseEquipment? Equipment { get; set; }

    /// <summary>
    /// Filter by exercise category.
    /// </summary>
    public ExerciseCategory? Category { get; set; }

    /// <summary>
    /// Filter by difficulty level.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page. Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
