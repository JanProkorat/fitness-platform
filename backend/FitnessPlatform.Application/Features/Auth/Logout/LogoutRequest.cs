namespace FitnessPlatform.Application.Features.Auth.Logout;

/// <summary>
/// Request model for logging out (revoking a refresh token).
/// </summary>
public class LogoutRequest
{
    /// <summary>
    /// The refresh token to revoke.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;
}
