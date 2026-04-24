namespace FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;

/// <summary>
/// Request model for saving the complete photo and note state of a meal diary entry.
/// The Photos list and Note are replaced with exactly what the client sends.
/// </summary>
public class SaveMealPhotosRequest
{
    /// <summary>
    /// The unique identifier of the meal whose photos/note are being saved.
    /// Sourced from the route segment <c>{MealId}</c>.
    /// </summary>
    public Guid MealId { get; set; }

    /// <summary>
    /// The complete list of MinIO blob URLs for photos to persist on the meal log.
    /// Replaces the existing Photos list entirely — pass an empty list to remove all
    /// photos. The client uploads photos via the signed-URL helper and submits the
    /// resulting URLs here. Existing URLs that are re-submitted keep their original
    /// <c>UploadedAt</c> timestamp; new URLs receive the current UTC time.
    /// </summary>
    public List<string> PhotoBlobUrls { get; set; } = [];

    /// <summary>
    /// Optional free-text note to persist on the meal log entry (max 500 chars).
    /// When non-null, the stored note is replaced with the trimmed value (whitespace-only
    /// strings are treated as null). When null, the existing note is cleared.
    /// </summary>
    public string? Note { get; set; }
}
