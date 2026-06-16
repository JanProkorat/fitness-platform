namespace FitnessPlatform.Application.Features.Auth.SocialLogin.RequestNonce;

/// <summary>
/// Response body for <c>POST /auth/social/nonce</c>.
/// </summary>
public class RequestNonceResponse
{
    /// <summary>
    /// The raw nonce value to embed in the Apple/Google sign-in flow.
    /// Apple expects SHA-256(nonce) in the id_token; Google expects the raw value.
    /// </summary>
    public string Nonce { get; set; } = string.Empty;
}
