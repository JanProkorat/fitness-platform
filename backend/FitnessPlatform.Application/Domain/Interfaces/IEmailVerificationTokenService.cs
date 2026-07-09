using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Issues and sends a fresh email-verification token for a user.
/// </summary>
/// <remarks>
/// Extracted (#679, rule-of-three) from logic that used to be duplicated in
/// <c>RegisterEndpoint</c> and <c>ResendVerificationEndpoint</c> — invalidate the
/// user's previously issued unused tokens, mint a new 32-byte hex token with a
/// 24-hour expiry, optionally increment <see cref="ApplicationUser.VerificationEmailsSent"/>,
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
    /// <param name="countTowardLifetimeCap">
    /// Whether this send advances <see cref="ApplicationUser.VerificationEmailsSent"/>,
    /// the LIFETIME counter the AUTHENTICATED <c>/auth/resend-verification</c> endpoint
    /// gates on. Defaults to <c>true</c> so the registration and authenticated-resend
    /// call sites keep their exact original behavior.
    /// <para>
    /// The anonymous resend endpoint (#679 security follow-up) passes <c>false</c> here.
    /// Because that endpoint is unauthenticated, it is throttled separately by a
    /// rolling-24h window over <see cref="EmailVerificationToken"/> rows rather than by
    /// this lifetime counter — letting anonymous sends advance the lifetime counter
    /// would let any caller who knows a victim's email address drive it to the cap and
    /// permanently lock that victim out of the AUTHENTICATED resend path too (an
    /// anonymous denial-of-verification). Anonymous sends must never move this counter.
    /// </para>
    /// </param>
    Task IssueAndSendAsync(ApplicationUser user, string language, CancellationToken ct, bool countTowardLifetimeCap = true);
}
