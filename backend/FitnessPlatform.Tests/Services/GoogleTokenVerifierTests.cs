using FluentAssertions;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for the nonce-comparison logic in <see cref="GoogleTokenVerifier"/>.
/// <para>
/// <see cref="GoogleTokenVerifier.VerifyAsync"/> delegates to
/// <see cref="GoogleTokenVerifier.ValidateNonce"/> for the security-critical comparison.
/// That helper is tested here in isolation because the full <c>VerifyAsync</c> path requires
/// a real Google-signed ID token (which cannot be minted in a unit test), whereas the nonce
/// comparison itself is pure in-process logic that deserves direct coverage.
/// </para>
/// <para>
/// Note: Apple's equivalent (<see cref="AppleTokenVerifier.ComputeSha256Hex"/> + nonce
/// comparison inside <c>VerifyAsync</c>) IS tested end-to-end in
/// <see cref="AppleTokenVerifierTests"/> using self-signed RSA tokens because the hand-rolled
/// Apple verifier accepts an injectable OIDC config manager. Google's verifier delegates to
/// <c>GoogleJsonWebSignature.ValidateAsync</c>, which has no equivalent test seam.
/// </para>
/// </summary>
public class GoogleTokenVerifierTests
{
    // ── ValidateNonce — matching ──────────────────────────────────────────────

    [Fact]
    public void ValidateNonce_MatchingNonce_DoesNotThrow()
    {
        // Arrange
        const string rawNonce = "server-issued-nonce-abc123";

        // Act — Google embeds the raw nonce (no hashing), so tokenNonce == expectedNonce
        var act = () => GoogleTokenVerifier.ValidateNonce(rawNonce, rawNonce);

        // Assert
        act.Should().NotThrow();
    }

    // ── ValidateNonce — mismatch ──────────────────────────────────────────────

    [Fact]
    public void ValidateNonce_MismatchedNonce_ThrowsInvalidOperationException()
    {
        // Arrange — token carries a different nonce than what the server issued
        const string tokenNonce = "nonce-from-token";
        const string expectedNonce = "nonce-issued-by-server";

        // Act
        var act = () => GoogleTokenVerifier.ValidateNonce(tokenNonce, expectedNonce);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*nonce does not match*");
    }

    // ── ValidateNonce — null / empty token nonce ──────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ValidateNonce_NullOrEmptyTokenNonce_ThrowsInvalidOperationException(string? tokenNonce)
    {
        // Arrange — token is missing the nonce field (omitted by the provider or stripped)
        const string expectedNonce = "server-issued-nonce-abc123";

        // Act
        var act = () => GoogleTokenVerifier.ValidateNonce(tokenNonce, expectedNonce);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*missing the 'nonce' field*");
    }
}
