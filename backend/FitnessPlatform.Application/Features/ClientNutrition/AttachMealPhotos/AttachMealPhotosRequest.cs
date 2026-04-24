namespace FitnessPlatform.Application.Features.ClientNutrition.AttachMealPhotos;

/// <summary>
/// Request model for attaching photos and/or a note to a meal diary entry.
/// Neither field is required — callers may supply one or both.
/// </summary>
public class AttachMealPhotosRequest
{
    /// <summary>
    /// The unique identifier of the meal to attach photos/note to.
    /// Sourced from the route segment <c>{mealId}</c>.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// Optional list of MinIO blob URLs for photos to append to the meal log.
    /// The client uploads photos via the signed-URL helper and submits the
    /// resulting URLs here. Duplicate URLs are accepted — no deduplication is
    /// performed. When null or empty, no photos are added.
    /// </summary>
    public List<string>? PhotoBlobUrls { get; set; }

    /// <summary>
    /// Optional free-text note to attach to the meal log entry (max 500 chars).
    /// When non-null the stored note is replaced with the trimmed value.
    /// When null the existing note is left unchanged (pass null to skip updates,
    /// not to clear — clearing is out of scope).
    /// </summary>
    public string? Note { get; set; }
}
