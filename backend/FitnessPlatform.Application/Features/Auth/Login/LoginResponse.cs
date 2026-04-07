namespace FitnessPlatform.Application.Features.Auth.Login;

/// <summary>
/// Response model returned after successful login.
/// </summary>
public class LoginResponse
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
    /// </summary>
    public bool EmailConfirmed { get; set; }
}
