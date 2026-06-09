namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Google;

/// <summary>
/// Request body for <c>POST /auth/social/google</c>.
/// </summary>
public class GoogleSocialLoginRequest
{
    /// <summary>
    /// The Google ID token returned by the Google Identity Services flow on the client.
    /// </summary>
    public string IdToken { get; set; } = string.Empty;
}
