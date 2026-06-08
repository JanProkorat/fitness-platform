namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Google;

/// <summary>
/// Response returned after a successful Google social login.
/// Shape is intentionally identical to <c>LoginResponse</c> so clients
/// can reuse the same token-storage logic.
/// </summary>
public class GoogleSocialLoginResponse
{
    /// <summary>
    /// JWT access token (short-lived, 15 minutes).
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Refresh token for obtaining new access tokens (7 days).
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// Access token expiration time in UTC.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Whether the user's email address has been verified.
    /// Always <see langword="true"/> for Google-provisioned accounts because Google
    /// verifies the email before issuing the ID token.
    /// </summary>
    public bool EmailConfirmed { get; set; }
}
