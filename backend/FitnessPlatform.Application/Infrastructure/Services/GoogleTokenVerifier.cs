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

        return new GoogleTokenPayload(
            Subject: payload.Subject,
            Email: payload.Email,
            Name: payload.Name);
    }
}
