namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateMealPhotoUploadUrl;

/// <summary>
/// Response model containing the pre-signed upload URL and the permanent blob URL
/// for a meal diary photo.
/// </summary>
public class GenerateMealPhotoUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client should PUT the image file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// Permanent blob URL at which the photo will be accessible after a successful upload.
    /// Always starts with <c>diary/{mealId}/</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
