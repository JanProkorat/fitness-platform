using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="AppleTokenVerifier"/> that exercise the REAL verifier
/// against a self-signed RSA test key — not a mock. These tests are the regression
/// guard for the MapInboundClaims bug (PR #510): the happy-path test must FAIL when
/// MapInboundClaims defaults to true and PASS after setting it to false.
/// </summary>
public class AppleTokenVerifierTests : IDisposable
{
    // A real RSA key generated once per test-class instance.
    private readonly RSA _rsa = RSA.Create(2048);
    private readonly string _kid = "test-key-id";
    private const string AppleIssuer = "https://appleid.apple.com";
    private const string TestAudience = "com.example.testapp";

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds an <see cref="AppleTokenVerifier"/> wired to the test RSA key via the
    /// internal seam constructor — no HTTP calls, no Apple JWKS endpoint.
    /// </summary>
    private AppleTokenVerifier BuildVerifier()
    {
        var rsaSecurityKey = new RsaSecurityKey(_rsa) { KeyId = _kid };

        var oidcConfig = new OpenIdConnectConfiguration();
        oidcConfig.SigningKeys.Add(rsaSecurityKey);

        var configManager = Substitute.For<IConfigurationManager<OpenIdConnectConfiguration>>();
        configManager
            .GetConfigurationAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(oidcConfig));

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ConfigKeys.AppleClientId] = TestAudience
            })
            .Build();

        return new AppleTokenVerifier(config, configManager);
    }

    /// <summary>
    /// Signs a JWT with the test RSA key.
    /// </summary>
    /// <param name="notBefore">Start of the token validity window. Defaults to now.</param>
    /// <param name="expires">End of the token validity window. Defaults to one hour from now.</param>
    private string BuildToken(
        string sub,
        string? email = null,
        string? emailVerified = null,
        string? isPrivateEmail = null,
        string issuer = AppleIssuer,
        string audience = TestAudience,
        DateTime? notBefore = null,
        DateTime? expires = null,
        SecurityAlgorithm algorithm = SecurityAlgorithm.Rs256)
    {
        var claims = new List<Claim> { new("sub", sub) };
        if (email is not null) claims.Add(new Claim("email", email));
        if (emailVerified is not null) claims.Add(new Claim("email_verified", emailVerified));
        if (isPrivateEmail is not null) claims.Add(new Claim("is_private_email", isPrivateEmail));

        SigningCredentials signingCredentials;
        switch (algorithm)
        {
            case SecurityAlgorithm.Rs256:
                signingCredentials = new SigningCredentials(
                    new RsaSecurityKey(_rsa) { KeyId = _kid },
                    SecurityAlgorithms.RsaSha256);
                break;

            case SecurityAlgorithm.Hs256WithRsaPublicKeyBytes:
                // Algorithm confusion attack: sign with HS256 using the RSA public key bytes as secret.
                var publicKeyBytes = _rsa.ExportRSAPublicKey();
                signingCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(publicKeyBytes),
                    SecurityAlgorithms.HmacSha256);
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(algorithm));
        }

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = issuer,
            Audience = audience,
            NotBefore = notBefore ?? DateTime.UtcNow.AddMinutes(-5),
            Expires = expires ?? DateTime.UtcNow.AddHours(1),
            SigningCredentials = signingCredentials,
        };

        return handler.CreateEncodedJwt(descriptor);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    /// <summary>
    /// A valid RS256 token with verified email must return the correct Subject and Email.
    /// This test is the direct regression guard for the MapInboundClaims bug:
    ///   WITHOUT MapInboundClaims = false → FindFirstValue("sub") returns null → throws.
    ///   WITH    MapInboundClaims = false → FindFirstValue("sub") returns "apple-test-sub" → passes.
    /// </summary>
    [Fact]
    public async Task VerifyAsync_ValidToken_ReturnsCorrectSubjectAndEmail()
    {
        var verifier = BuildVerifier();
        var token = BuildToken(
            sub: "apple-test-sub",
            email: "user@example.com",
            emailVerified: "true");

        var result = await verifier.VerifyAsync(token);

        result.Subject.Should().Be("apple-test-sub");
        result.Email.Should().Be("user@example.com");
        result.EmailVerified.Should().BeTrue();
        result.IsPrivateEmail.Should().BeFalse();
    }

    // ── email_verified / is_private_email parsing ─────────────────────────────

    [Fact]
    public async Task VerifyAsync_StringTrueEmailVerified_ParsedCorrectly()
    {
        var verifier = BuildVerifier();
        var token = BuildToken(
            sub: "sub-1",
            email: "test@apple.com",
            emailVerified: "true",
            isPrivateEmail: "false");

        var result = await verifier.VerifyAsync(token);

        result.EmailVerified.Should().BeTrue();
        result.IsPrivateEmail.Should().BeFalse();
    }

    [Fact]
    public async Task VerifyAsync_StringFalseEmailVerified_ParsedCorrectly()
    {
        var verifier = BuildVerifier();
        // Unverified non-private-relay email → verifier must throw (security gate).
        var token = BuildToken(
            sub: "sub-2",
            email: "test@example.com",
            emailVerified: "false",
            isPrivateEmail: "false");

        var act = () => verifier.VerifyAsync(token);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*unverified*");
    }

    [Fact]
    public async Task VerifyAsync_PrivateRelayEmailWithMissingEmailVerified_Accepted()
    {
        // Private-relay emails have no email_verified claim in the token.
        // The verifier must still accept them and set EmailVerified = true (IsPrivateEmail implies verified).
        var verifier = BuildVerifier();
        var token = BuildToken(
            sub: "sub-3",
            email: "xyz@privaterelay.appleid.com",
            emailVerified: null,    // absent — real Apple private-relay tokens omit this
            isPrivateEmail: "true");

        var result = await verifier.VerifyAsync(token);

        result.IsPrivateEmail.Should().BeTrue();
        result.EmailVerified.Should().BeTrue(); // because IsPrivateEmail → EmailVerified = true
    }

    // ── Algorithm-confusion attack guard ──────────────────────────────────────

    /// <summary>
    /// A token signed with HS256 using the RSA public key bytes as the HMAC secret must
    /// be rejected. This proves ValidAlgorithms = ["RS256"] blocks the classic alg-confusion attack.
    /// </summary>
    [Fact]
    public async Task VerifyAsync_Hs256TokenSignedWithRsaPublicKeyBytes_Rejected()
    {
        var verifier = BuildVerifier();
        var token = BuildToken(
            sub: "attacker",
            algorithm: SecurityAlgorithm.Hs256WithRsaPublicKeyBytes);

        var act = () => verifier.VerifyAsync(token);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // ── Rejection scenarios ───────────────────────────────────────────────────

    [Fact]
    public async Task VerifyAsync_WrongAudience_Rejected()
    {
        var verifier = BuildVerifier();
        var token = BuildToken(sub: "sub-bad-aud", audience: "com.attacker.app");

        var act = () => verifier.VerifyAsync(token);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task VerifyAsync_WrongIssuer_Rejected()
    {
        var verifier = BuildVerifier();
        var token = BuildToken(sub: "sub-bad-iss", issuer: "https://evil.example.com");

        var act = () => verifier.VerifyAsync(token);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task VerifyAsync_ExpiredToken_Rejected()
    {
        var verifier = BuildVerifier();
        // Both notBefore and expires are in the past so the JWT is well-formed but expired.
        var token = BuildToken(
            sub: "sub-expired",
            notBefore: DateTime.UtcNow.AddHours(-3),
            expires: DateTime.UtcNow.AddHours(-2));

        var act = () => verifier.VerifyAsync(token);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // ── IDisposable ───────────────────────────────────────────────────────────

    public void Dispose() => _rsa.Dispose();

    // ── Helper enum ──────────────────────────────────────────────────────────

    internal enum SecurityAlgorithm
    {
        Rs256,
        Hs256WithRsaPublicKeyBytes
    }
}
