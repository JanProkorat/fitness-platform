namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Request model for generating a pre-signed avatar upload URL.
/// </summary>
public class GenerateAvatarUploadUrlRequest
{
    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
