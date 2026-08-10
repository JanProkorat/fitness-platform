using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.SearchTemplates;

/// <summary>
/// Request to search training plan templates with optional filters and pagination.
/// </summary>
public class SearchTrainingPlanTemplatesRequest
{
    /// <summary>
    /// Optional case-insensitive substring match against the template name.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Optional filter by primary fitness goal.
    /// </summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>
    /// Optional filter by difficulty level.
    /// </summary>
    public ExerciseDifficulty? Difficulty { get; set; }

    /// <summary>
    /// Optional filter by exact week count.
    /// </summary>
    public int? WeekCount { get; set; }

    /// <summary>
    /// Page number (1-based).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
