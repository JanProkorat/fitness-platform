namespace FitnessPlatform.Application.Features.Users.AddRole;

/// <summary>
/// Response returned after successfully adding a role, containing fresh tokens with updated claims.
/// </summary>
public class AddRoleResponse
{
    /// <summary>
    /// Fresh JWT access token containing the updated roles.
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// New refresh token.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// Expiration time of the new access token.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// The role that was added.
    /// </summary>
    public string AddedRole { get; set; } = string.Empty;
}
