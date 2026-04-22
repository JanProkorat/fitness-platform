namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Response model containing the pre-signed upload URL and the permanent blob URL.
/// </summary>
public class UploadFoodImageUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client should PUT the image file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// Permanent blob URL at which the food image will be accessible after a successful upload.
    /// Always starts with <c>foods/</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
