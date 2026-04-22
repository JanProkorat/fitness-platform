namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Response model containing the pre-signed upload URL and the permanent blob URL.
/// </summary>
public class GenerateAvatarUploadUrlResponse
{
    /// <summary>
    /// Time-limited pre-signed URL the client should PUT the image file to.
    /// </summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>
    /// Permanent blob URL at which the avatar will be accessible after a successful upload.
    /// Always starts with <c>avatars/</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
