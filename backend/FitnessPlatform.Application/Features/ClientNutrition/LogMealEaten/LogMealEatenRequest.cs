namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Request model for logging a meal as eaten.
/// </summary>
public class LogMealEatenRequest
{
    /// <summary>
    /// The unique identifier of the meal to log as eaten.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Optional list of MinIO blob URLs for photos attached to this meal.
    /// The client uploads photos via the signed-URL helper (Epic #65) and
    /// submits the resulting URLs here. When null or empty, no photos are stored.
    /// </summary>
    public List<string>? PhotoBlobUrls { get; set; }

    /// <summary>
    /// Optional free-text note attached to this meal log entry (max 500 chars).
    /// </summary>
    public string? Note { get; set; }
}
