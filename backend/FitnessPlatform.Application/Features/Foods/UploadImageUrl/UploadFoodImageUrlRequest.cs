namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Request model for generating a pre-signed upload URL for a food image.
/// </summary>
public class UploadFoodImageUrlRequest
{
    /// <summary>
    /// The food's public identifier (from route).
    /// </summary>
    public Guid FoodId { get; set; }

    /// <summary>
    /// MIME type of the image file (e.g. "image/jpeg", "image/png", "image/webp").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Declared file size in bytes. Must not exceed 5 MiB.
    /// </summary>
    public long SizeBytes { get; set; }
}
