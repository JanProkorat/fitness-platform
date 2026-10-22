namespace FitnessPlatform.Application.Features.ClientPhotos.GenerateUnlinkedPhotoUploadUrl;

/// <summary>
/// Request model for generating a pre-signed upload URL for a progress photo that has no plan.
/// </summary>
public class GenerateUnlinkedPhotoUploadUrlRequest
{
    /// <summary>
    /// MIME type of the image file (image/jpeg, image/png, image/webp, image/heic, image/heif).
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
