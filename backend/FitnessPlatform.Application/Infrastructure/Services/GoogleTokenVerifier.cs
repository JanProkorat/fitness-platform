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
    public async Task<GoogleTokenPayload> VerifyAsync(string idToken, CancellationToken ct = default)
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

        return new GoogleTokenPayload(
            Subject: payload.Subject,
            Email: payload.Email,
            Name: payload.Name);
    }
}
