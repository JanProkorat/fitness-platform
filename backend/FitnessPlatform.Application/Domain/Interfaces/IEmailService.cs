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
    /// <param name="language">Two-letter language code (en, cs, de). Defaults to en.</param>
    /// <param name="personalMessage">Optional personal message from the trainer to include in the email.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, string? personalMessage, CancellationToken ct);

    /// <summary>
    /// Sends a password reset email containing a link to reset the user's password.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="resetToken">The password reset token.</param>
    /// <param name="language">Two-letter language code (en, cs, de). Defaults to en.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct);

    /// <summary>
    /// Sends an email verification email containing a link to verify the user's email address.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="verificationToken">The verification token.</param>
    /// <param name="language">Two-letter language code (en, cs, de). Defaults to en.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendEmailVerificationAsync(string toEmail, string verificationToken, string language, CancellationToken ct);
}
