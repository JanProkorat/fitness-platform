namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Apple;

/// <summary>
/// Request body for the Apple Sign-In endpoint.
/// The identity token is always required. The authorization code and name fields
/// are only present on first authorization (Apple omits them on re-auth).
/// </summary>
public class AppleSocialLoginRequest
{
    /// <summary>
    /// The Apple identity token (JWT) returned by the Apple JS SDK or native Sign-In.
    /// </summary>
    public string IdentityToken { get; set; } = string.Empty;

    /// <summary>
    /// The authorization code returned by Apple (forwarded for forward-compatibility).
    /// The backend does not currently exchange this for tokens — identity verification
    /// is performed via the identity token alone.
    /// </summary>
    public string? AuthorizationCode { get; set; }

    /// <summary>
    /// The user's first name, present only on first authorization.
    /// Apple does not re-send this on subsequent authentications.
    /// </summary>
    public string? FirstName { get; set; }

    /// <summary>
    /// The user's last name, present only on first authorization.
    /// Apple does not re-send this on subsequent authentications.
    /// </summary>
    public string? LastName { get; set; }
}
