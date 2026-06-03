namespace FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;

/// <summary>
/// Request model for saving the complete photo and note state of a training session diary entry.
/// The Photos list and Note are replaced with exactly what the client sends.
/// </summary>
public class SaveSessionPhotosRequest
{
    /// <summary>
    /// The unique identifier of the training session whose photos/note are being saved.
    /// Sourced from the route segment <c>{SessionId}</c>.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The complete list of photos to persist on the session log.
    /// Replaces the existing Photos list entirely — pass an empty list to remove all photos.
    /// Each item carries the blob URL and an optional per-photo caption.
    /// Existing URLs that are re-submitted keep their original <c>UploadedAt</c>
    /// timestamp; new URLs receive the current UTC time.
    /// </summary>
    public List<SessionPhotoInput> Photos { get; set; } = [];

    /// <summary>
    /// Optional free-text note to persist on the session log entry (max 500 chars).
    /// When non-null, the stored note is replaced with the trimmed value
    /// (whitespace-only strings are treated as null). When null, the existing note is cleared.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// A single photo input in a <see cref="SaveSessionPhotosRequest"/>.
/// </summary>
public class SessionPhotoInput
{
    /// <summary>
    /// The MinIO blob URL for this photo, as returned by the signed-URL upload helper.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional per-photo caption (max 500 chars).
    /// </summary>
    public string? Note { get; set; }
}
