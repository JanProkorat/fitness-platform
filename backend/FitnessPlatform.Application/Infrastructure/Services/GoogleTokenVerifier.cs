using Google.Apis.Auth;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Production implementation of <see cref="IGoogleTokenVerifier"/> using
/// <c>Google.Apis.Auth</c> for offline token verification against Google public keys.
/// </summary>
public class GoogleTokenVerifier(IConfiguration config) : IGoogleTokenVerifier
{
    /// <inheritdoc />
    public async Task<GoogleTokenPayload> VerifyAsync(string idToken, string expectedNonce, CancellationToken ct = default)
    {
        var clientId = config[ConfigKeys.GoogleClientId]
            ?? throw new InvalidOperationException("Google:ClientId is not configured.");

        GoogleJsonWebSignature.Payload payload;

        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId]
                });
        }
        catch (InvalidJwtException ex)
        {
            throw new InvalidOperationException("Google ID token verification failed.", ex);
        }

        // Reject tokens whose email has not been verified by Google.
        // An unverified email could be used to hijack an account via email-matching
        // or to provision an account under an email the attacker does not own.
        if (payload.EmailVerified != true)
        {
            throw new InvalidOperationException(
                "Google ID token has an unverified email address (email_verified is not true).");
        }

        // Nonce verification: Google embeds the raw nonce directly in the payload's Nonce field.
        // Reject the token if the field is absent or does not match expectedNonce exactly.
        if (string.IsNullOrEmpty(payload.Nonce))
        {
            throw new InvalidOperationException(
                "Google ID token is missing the 'nonce' field. The sign-in must embed a nonce.");
        }

        if (!string.Equals(payload.Nonce, expectedNonce, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Google ID token nonce does not match the expected nonce. Possible replay attack.");
        }

        return new GoogleTokenPayload(
            Subject: payload.Subject,
            Email: payload.Email,
            Name: payload.Name);
    }
}
