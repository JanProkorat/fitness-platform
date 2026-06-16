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

    /// <summary>
    /// The raw nonce value obtained from <c>POST /auth/social/nonce</c>.
    /// The client must pass the same raw value that was embedded in the Google sign-in flow
    /// (Google embeds the raw nonce directly in the id_token's nonce field — no hashing).
    /// </summary>
    public string Nonce { get; set; } = string.Empty;
}
