namespace FitnessPlatform.Application.Features.ClientTraining.GenerateSessionPhotoUploadUrl;

/// <summary>
/// Request model for generating a pre-signed training session photo upload URL.
/// </summary>
public class GenerateSessionPhotoUploadUrlRequest
{
    /// <summary>
    /// The unique identifier of the session the photo will be attached to.
    /// Sourced from the route segment <c>{SessionId}</c>.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 10 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
