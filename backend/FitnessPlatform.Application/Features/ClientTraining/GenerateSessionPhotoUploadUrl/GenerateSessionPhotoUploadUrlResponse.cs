namespace FitnessPlatform.Application.Features.ClientTraining.GenerateSessionPhotoUploadUrl;

/// <summary>
/// Response for the session photo upload URL generation endpoint.
/// </summary>
public class GenerateSessionPhotoUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client uses to PUT the image directly to blob storage.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// The permanent blob URL to pass to <c>POST /client/training/log/sessions/{sessionId}/photos</c>
    /// after the upload completes.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
