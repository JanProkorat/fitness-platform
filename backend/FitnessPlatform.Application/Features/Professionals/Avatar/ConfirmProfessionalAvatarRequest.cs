namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Request model for confirming the uploaded professional avatar blob URL.
/// </summary>
public class ConfirmProfessionalAvatarRequest
{
    /// <summary>
    /// The permanent blob URL returned by <c>POST /professionals/me/avatar/upload-url</c>.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;
}
