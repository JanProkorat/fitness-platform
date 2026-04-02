namespace FitnessPlatform.Application.Features.Auth.VerifyEmail;

/// <summary>
/// Request model for email verification.
/// </summary>
public class VerifyEmailRequest
{
    /// <summary>
    /// The verification token from the email link.
    /// </summary>
    public string Token { get; set; } = string.Empty;
}
