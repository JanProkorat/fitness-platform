namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Provides methods for sending transactional emails.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Sends a client invitation email containing a link to accept the invitation.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="trainerName">The name of the trainer who sent the invitation.</param>
    /// <param name="invitationToken">The unique token for accepting the invitation.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, CancellationToken ct);

    /// <summary>
    /// Sends a password reset email containing a link to reset the user's password.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="resetToken">The password reset token.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendPasswordResetEmailAsync(string toEmail, string resetToken, CancellationToken ct);
}
