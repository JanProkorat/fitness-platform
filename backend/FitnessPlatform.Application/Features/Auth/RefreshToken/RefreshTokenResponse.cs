namespace FitnessPlatform.Application.Features.Auth.RefreshToken;

/// <summary>
/// Response model returned after successful token refresh.
/// </summary>
public class RefreshTokenResponse
{
    /// <summary>
    /// New JWT access token.
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// New refresh token (old one is invalidated via rotation).
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// New access token expiration time in UTC.
    /// </summary>
    public DateTime ExpiresAt { get; set; }
}
