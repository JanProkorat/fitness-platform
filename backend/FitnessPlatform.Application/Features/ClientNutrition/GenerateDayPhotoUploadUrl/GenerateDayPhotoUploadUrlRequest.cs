namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateDayPhotoUploadUrl;

/// <summary>
/// Request model for generating a pre-signed day-level plan photo upload URL.
/// </summary>
public class GenerateDayPhotoUploadUrlRequest
{
    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp", "image/heic").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 10 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
