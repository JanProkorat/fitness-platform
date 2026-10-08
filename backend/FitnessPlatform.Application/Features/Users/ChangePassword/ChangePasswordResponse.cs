namespace FitnessPlatform.Application.Features.Users.ChangePassword;

/// <summary>
/// Fresh token pair returned after a password change; all previous refresh tokens are revoked.
/// </summary>
public class ChangePasswordResponse
{
    /// <summary>
    /// New JWT access token.
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// New refresh token.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// UTC expiry of the access token.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// UTC time the password was changed.
    /// </summary>
    public DateTime PasswordChangedAt { get; set; }
}
