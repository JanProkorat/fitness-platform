using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;

/// <summary>
/// Response model for the client's meal log for today.
/// </summary>
public class GetTodayLogResponse
{
    /// <summary>
    /// Meals eaten today.
    /// </summary>
    public List<TodayMealLogDto> MealsEaten { get; set; } = [];

    /// <summary>
    /// Total nutrients consumed across all meals today.
    /// </summary>
    public NutrientTotals TotalConsumed { get; set; } = new();

    /// <summary>
    /// Remaining nutrients to reach the daily target.
    /// Null if the active plan has no global settings.
    /// </summary>
    public NutrientTotals? Remaining { get; set; }
}

/// <summary>
/// DTO representing a single logged meal with computed nutrient totals.
/// </summary>
public class TodayMealLogDto
{
    /// <summary>
    /// Identifier of the meal that was eaten.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Display name of the meal (resolved from the plan).
    /// </summary>
    public string MealName { get; set; } = string.Empty;

    /// <summary>
    /// When the meal was eaten. Null for photo/note-only log entries that have not
    /// been confirmed as eaten via the quick-log button.
    /// </summary>
    public DateTime? EatenAt { get; set; }

    /// <summary>
    /// Computed nutrient totals for this logged meal.
    /// </summary>
    public NutrientTotals Totals { get; set; } = new();

    /// <summary>
    /// Photos attached to this meal log entry.
    /// Empty list when the client logged without photos.
    /// </summary>
    public List<MealPhotoDto> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note the client attached when logging the meal.
    /// Null when no note was provided.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// DTO for a single photo reference on a meal log entry.
/// </summary>
public class MealPhotoDto
{
    /// <summary>
    /// The MinIO blob URL for this photo.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the photo was uploaded.
    /// </summary>
    public DateTime UploadedAt { get; set; }

    /// <summary>
    /// Optional per-photo caption set by the client when saving photos.
    /// Null when no caption was provided for this photo.
    /// </summary>
    public string? Note { get; set; }
}
