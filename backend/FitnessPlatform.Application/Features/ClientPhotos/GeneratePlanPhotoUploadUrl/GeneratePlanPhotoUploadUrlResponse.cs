namespace FitnessPlatform.Application.Features.ClientPlans.GeneratePlanPhotoUploadUrl;

/// <summary>
/// Response for the plan photo upload URL generation endpoint.
/// Consistent with the shape used by GenerateMealPhotoUploadUrlEndpoint
/// and GenerateDayPhotoUploadUrlEndpoint.
/// </summary>
public class GeneratePlanPhotoUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed PUT URL for direct upload to blob storage.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// The permanent blob URL where the image will be accessible after upload.
    /// Pass this to POST /client/plans/{planId}/photos to finalize the record.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
