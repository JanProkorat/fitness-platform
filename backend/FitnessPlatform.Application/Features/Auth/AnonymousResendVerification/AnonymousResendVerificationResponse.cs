namespace FitnessPlatform.Application.Features.Auth.AnonymousResendVerification;

/// <summary>
/// Response model for an anonymous resend-verification request.
/// Deliberately generic — the same message is returned regardless of whether the
/// email is registered, already verified, or has hit its resend cap, so the
/// response body never becomes an account-existence oracle.
/// </summary>
public class AnonymousResendVerificationResponse
{
    /// <summary>
    /// Generic, state-independent confirmation message.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}
