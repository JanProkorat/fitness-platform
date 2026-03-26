namespace FitnessPlatform.Application.Features.Exercises.GenerateUploadUrl;

/// <summary>
/// Response model containing the pre-signed upload URL.
/// </summary>
public class GenerateUploadUrlResponse
{
    /// <summary>
    /// The pre-signed URL the client should PUT the video file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// The permanent URL where the video will be accessible after upload.
    /// </summary>
    public string VideoUrl { get; set; } = string.Empty;
}
