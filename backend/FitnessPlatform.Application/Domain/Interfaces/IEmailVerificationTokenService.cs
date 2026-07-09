using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Issues and sends a fresh email-verification token for a user.
/// </summary>
/// <remarks>
/// Extracted (#679, rule-of-three) from logic that used to be duplicated in
/// <c>RegisterEndpoint</c> and <c>ResendVerificationEndpoint</c> — invalidate the
/// user's previously issued unused tokens, mint a new 32-byte hex token with a
/// 24-hour expiry, increment <see cref="ApplicationUser.VerificationEmailsSent"/>,
/// persist, then send the verification email. All three call sites (registration,
/// the authenticated resend endpoint, and the anonymous resend endpoint) share
/// this single implementation.
/// </remarks>
public interface IEmailVerificationTokenService
{
    /// <summary>
    /// Invalidates the user's previously issued unused verification tokens, mints a
    /// new token, persists the change, and sends the verification email.
    /// </summary>
    /// <param name="user">The user to issue a token for. Must be tracked by the same
    /// database context instance used elsewhere in the caller's unit of work.</param>
    /// <param name="language">Two-letter language code (en, cs, de) for the email template.</param>
    /// <param name="ct">Cancellation token.</param>
    Task IssueAndSendAsync(ApplicationUser user, string language, CancellationToken ct);
}
