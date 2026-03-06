namespace FitnessPlatform.Application.Features.Auth.RefreshToken;

/// <summary>
/// Request model for refreshing an access token using a refresh token.
/// </summary>
public class RefreshTokenRequest
{
    /// <summary>
    /// The current refresh token to exchange for a new token pair.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;
}
