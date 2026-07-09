namespace FitnessPlatform.Application.Features.Auth.AnonymousResendVerification;

/// <summary>
/// Request model for requesting a verification-email resend by email address,
/// without an authenticated session.
/// </summary>
public class AnonymousResendVerificationRequest
{
    /// <summary>
    /// Email address of the account to resend a verification email for.
    /// </summary>
    public string Email { get; set; } = string.Empty;
}
