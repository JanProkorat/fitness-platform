namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Request model for confirming the uploaded avatar blob URL.
/// </summary>
public class ConfirmAvatarRequest
{
    /// <summary>
    /// The permanent blob URL returned by <c>POST /users/me/avatar/upload-url</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
