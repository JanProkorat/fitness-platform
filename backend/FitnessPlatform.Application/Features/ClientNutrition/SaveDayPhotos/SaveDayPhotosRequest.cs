using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;

/// <summary>
/// Request model for saving the complete photo and note state of a day diary entry.
/// The Photos list and Note are replaced with exactly what the client sends (replace semantics).
/// </summary>
public class SaveDayPhotosRequest
{
    /// <summary>
    /// The complete list of plan-level photos to persist on the day log.
    /// Replaces the existing Photos list entirely — pass an empty list to remove all photos.
    /// Existing URLs that are re-submitted keep their original <c>UploadedAt</c> timestamp;
    /// new URLs receive the current UTC time.
    /// </summary>
    public List<DayPhotoInput> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note at the day level (max 500 chars).
    /// When non-null, replaces the stored note (whitespace-only treated as null).
    /// When null, the existing note is cleared.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// A single photo input in a <see cref="SaveDayPhotosRequest"/>.
/// </summary>
public class DayPhotoInput
{
    /// <summary>
    /// The MinIO blob URL for this photo, as returned by the signed-URL upload helper.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional per-photo caption (max 500 chars).
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Display category for this photo (Food / Progress / Free).
    /// </summary>
    public DayPhotoCategory Category { get; set; } = DayPhotoCategory.Free;
}
