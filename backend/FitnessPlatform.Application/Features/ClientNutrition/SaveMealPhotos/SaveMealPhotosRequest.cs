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
    /// The complete list of photos to persist on the meal log.
    /// Replaces the existing Photos list entirely — pass an empty list to remove all
    /// photos. Each item carries the blob URL and an optional per-photo caption.
    /// Existing URLs that are re-submitted keep their original <c>UploadedAt</c>
    /// timestamp; new URLs receive the current UTC time.
    /// </summary>
    public List<MealPhotoInput> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note to persist on the meal log entry (max 500 chars).
    /// This is the meal-level diary note. When non-null, the stored note is replaced
    /// with the trimmed value (whitespace-only strings are treated as null). When null,
    /// the existing note is cleared.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// A single photo input in a <see cref="SaveMealPhotosRequest"/>.
/// </summary>
public class MealPhotoInput
{
    /// <summary>
    /// The MinIO blob URL for this photo, as returned by the signed-URL upload helper.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional per-photo caption (max 500 chars). Distinct from the meal-level
    /// <see cref="SaveMealPhotosRequest.Note"/> — this note belongs to the individual
    /// photo only (e.g. "Side of guac added").
    /// </summary>
    public string? Note { get; set; }
}
