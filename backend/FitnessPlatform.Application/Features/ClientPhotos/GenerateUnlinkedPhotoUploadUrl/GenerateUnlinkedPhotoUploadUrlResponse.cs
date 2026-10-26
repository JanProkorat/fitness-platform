namespace FitnessPlatform.Application.Features.ClientPhotos.GenerateUnlinkedPhotoUploadUrl;

/// <summary>
/// Response for the plan-less progress photo upload URL endpoint.
/// </summary>
public class GenerateUnlinkedPhotoUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed PUT URL for direct upload to blob storage.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// The permanent blob URL to pass to POST /client/photos to finalize the record.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
