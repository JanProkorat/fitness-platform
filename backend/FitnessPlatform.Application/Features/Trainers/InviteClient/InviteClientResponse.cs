namespace FitnessPlatform.Application.Features.Trainers.InviteClient;

/// <summary>
/// Response model returned after sending a client invitation.
/// </summary>
public class InviteClientResponse
{
    /// <summary>
    /// Confirmation message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Invitation token (exposed for dev/testing; would be emailed in production).
    /// </summary>
    public string InvitationToken { get; set; } = string.Empty;
}
