namespace FitnessPlatform.Application.Features.Auth.AcceptInvitation;

/// <summary>
/// Response model returned after successfully accepting an invitation.
/// </summary>
public class AcceptInvitationResponse
{
    /// <summary>
    /// Confirmation message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Public identifier of the trainer whose invitation was accepted.
    /// </summary>
    public Guid TrainerPublicId { get; set; }
}
