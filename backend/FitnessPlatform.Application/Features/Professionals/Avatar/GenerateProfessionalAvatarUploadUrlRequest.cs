namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Request model for generating a pre-signed professional avatar upload URL.
/// </summary>
public class GenerateProfessionalAvatarUploadUrlRequest
{
    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
