namespace FitnessPlatform.Application.Features.Auth.AcceptInvitation;

/// <summary>
/// Request model for accepting a trainer's invitation.
/// </summary>
public class AcceptInvitationRequest
{
    /// <summary>
    /// The one-time invitation token received from the trainer.
    /// </summary>
    public string Token { get; set; } = string.Empty;
}
