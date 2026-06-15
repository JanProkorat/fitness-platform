namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Represents the verified claims extracted from an Apple identity token.
/// </summary>
/// <param name="Subject">
/// The Apple subject identifier ("sub" claim) — stable per user per app team.
/// This is the primary correlation key because Apple only sends email on first auth.
/// </param>
/// <param name="Email">
/// The email address from the token. May be null when a returning user re-authenticates
/// (Apple omits it after first authorization). May be an Apple private-relay address
/// (e.g. xyz@privaterelay.appleid.com).
/// </param>
/// <param name="EmailVerified">
/// Whether Apple considers the email address verified.
/// Always true for private-relay addresses; true for regular Apple IDs that passed
/// Apple's verification flow.
/// </param>
/// <param name="IsPrivateEmail">
/// Whether the email is an Apple private-relay address.
/// Private-relay addresses are generated per app and hide the real email.
/// </param>
public record AppleTokenPayload(string Subject, string? Email, bool EmailVerified, bool IsPrivateEmail);

/// <summary>
/// Validates an Apple identity token and returns the verified payload.
/// Abstracted so tests can inject a fake without calling Apple.
/// </summary>
public interface IAppleTokenVerifier
{
    /// <summary>
    /// Validates <paramref name="identityToken"/> against Apple's public JWKS
    /// and the configured Apple Service ID (audience).
    /// </summary>
    /// <param name="identityToken">The raw Apple identity token (JWT) from the client.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The verified payload on success.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the token is invalid, expired, the audience does not match,
    /// the algorithm is not RS256, or the email is explicitly unverified and not a
    /// private-relay address.
    /// </exception>
    Task<AppleTokenPayload> VerifyAsync(string identityToken, CancellationToken ct = default);
}
