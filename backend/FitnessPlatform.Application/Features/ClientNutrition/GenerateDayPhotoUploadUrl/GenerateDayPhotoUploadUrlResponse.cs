namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateDayPhotoUploadUrl;

/// <summary>
/// Response model containing the pre-signed upload URL and the permanent blob URL
/// for a plan-level day diary photo.
/// </summary>
public class GenerateDayPhotoUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client should PUT the image file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// Permanent blob URL at which the photo will be accessible after a successful upload.
    /// Always follows the <c>plan-photos/{planId}/{guid}.{ext}</c> convention.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
