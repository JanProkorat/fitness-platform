namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Represents the verified claims extracted from a Google ID token.
/// <para><c>Subject</c>: The Google subject identifier ("sub" claim) — stable, globally unique per user.</para>
/// <para><c>Email</c>: The user's email address as verified by Google.</para>
/// <para><c>Name</c>: The user's display name from their Google profile (may be null).</para>
/// </summary>
public record GoogleTokenPayload(string Subject, string Email, string? Name);

/// <summary>
/// Validates a Google ID token and returns the verified payload.
/// Abstracted so tests can inject a fake without calling Google.
/// </summary>
public interface IGoogleTokenVerifier
{
    /// <summary>
    /// Validates <paramref name="idToken"/> against Google's public keys
    /// and the configured OAuth client ID.
    /// </summary>
    /// <param name="idToken">The raw Google ID token from the client.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The verified payload on success.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the token is invalid, expired, or the audience does not match.
    /// </exception>
    Task<GoogleTokenPayload> VerifyAsync(string idToken, CancellationToken ct = default);
}
