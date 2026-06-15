namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Apple;

/// <summary>
/// Response returned on a successful Apple Sign-In.
/// Identical shape to Google Social Login response.
/// </summary>
public class AppleSocialLoginResponse
{
    /// <summary>
    /// Short-lived JWT access token (15 minutes by default).
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Long-lived opaque refresh token (7 days by default).
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// UTC expiry time of the access token.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Whether the account's email address has been confirmed.
    /// Apple-provisioned and Apple-verified accounts always have this set to true,
    /// which causes the client to redirect to /download-app rather than /verify-email.
    /// </summary>
    public bool EmailConfirmed { get; set; }
}
