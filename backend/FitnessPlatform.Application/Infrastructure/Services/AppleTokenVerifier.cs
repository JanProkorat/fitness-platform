using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FitnessPlatform.Application.Domain.Constants;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Production implementation of <see cref="IAppleTokenVerifier"/> using hand-rolled
/// RS256 JWT validation against Apple's JWKS.
/// <para>
/// Uses <see cref="ConfigurationManager{T}"/> pointed at Apple's OpenID Connect
/// discovery document to automatically fetch, cache, and refresh the JWKS.
/// No external NuGet package is required — <c>Microsoft.IdentityModel.Protocols.OpenIdConnect</c>
/// is already present transitively via the JwtBearer authentication middleware.
/// </para>
/// </summary>
public class AppleTokenVerifier : IAppleTokenVerifier
{
    private const string AppleIssuer = "https://appleid.apple.com";
    private const string AppleDiscoveryEndpoint = "https://appleid.apple.com/.well-known/openid-configuration";

    private readonly IConfigurationManager<OpenIdConnectConfiguration> _configManager;
    private readonly IConfiguration _config;
    private readonly JwtSecurityTokenHandler _tokenHandler;

    /// <summary>
    /// Initializes a new instance of <see cref="AppleTokenVerifier"/>.
    /// </summary>
    /// <param name="httpClientFactory">Factory for creating named HTTP clients.</param>
    /// <param name="config">Application configuration (reads <c>Apple:ClientId</c>).</param>
    public AppleTokenVerifier(IHttpClientFactory httpClientFactory, IConfiguration config)
        : this(config, BuildConfigManager(httpClientFactory))
    {
    }

    /// <summary>
    /// Test seam constructor — injects a pre-configured OIDC config manager so tests
    /// can supply a self-signed RSA key without making real network calls.
    /// </summary>
    internal AppleTokenVerifier(
        IConfiguration config,
        IConfigurationManager<OpenIdConnectConfiguration> configManager)
    {
        _config = config;
        _configManager = configManager;

        // MapInboundClaims = false is REQUIRED: the default (true) remaps the JWT's
        // short claim names ("sub", "email", …) to long XML URI types, which makes
        // FindFirstValue("sub") return null and breaks every real Apple token.
        _tokenHandler = new JwtSecurityTokenHandler { MapInboundClaims = false };
    }

    private static IConfigurationManager<OpenIdConnectConfiguration> BuildConfigManager(
        IHttpClientFactory httpClientFactory)
    {
        // Use the ConfigurationManager pattern so JWKS is fetched and cached automatically.
        // It refreshes keys when the cache age exceeds the default (1 hour) or when an
        // unknown "kid" is encountered — handles Apple's key rotation.
        var httpClient = httpClientFactory.CreateClient("AppleAuth");
        var httpDocRetriever = new HttpDocumentRetriever(httpClient) { RequireHttps = true };

        return new ConfigurationManager<OpenIdConnectConfiguration>(
            AppleDiscoveryEndpoint,
            new OpenIdConnectConfigurationRetriever(),
            httpDocRetriever);
    }

    /// <inheritdoc />
    public async Task<AppleTokenPayload> VerifyAsync(string identityToken, string expectedNonce, CancellationToken ct = default)
    {
        var clientId = _config[ConfigKeys.AppleClientId]
            ?? throw new InvalidOperationException("Apple:ClientId is not configured.");

        // Fetch (or return cached) OpenID Connect configuration including the JWKS.
        OpenIdConnectConfiguration oidcConfig;
        try
        {
            oidcConfig = await _configManager.GetConfigurationAsync(ct);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to retrieve Apple JWKS configuration.", ex);
        }

        var validationParameters = new TokenValidationParameters
        {
            ValidIssuer = AppleIssuer,
            ValidAudience = clientId,
            // Explicitly restrict to RS256 — reject "none" and HS-family to block alg-confusion.
            ValidAlgorithms = ["RS256"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5),
            IssuerSigningKeys = oidcConfig.SigningKeys,
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidateAudience = true
        };

        ClaimsPrincipal principal;
        try
        {
            principal = _tokenHandler.ValidateToken(identityToken, validationParameters, out _);
        }
        catch (SecurityTokenException ex)
        {
            // If validation failed due to a key mismatch (Apple rotated), request a fresh
            // configuration and retry once. ConfigurationManager.RequestRefresh() marks the
            // cache as stale so the next GetConfigurationAsync fetches fresh keys.
            _configManager.RequestRefresh();

            OpenIdConnectConfiguration refreshedConfig;
            try
            {
                refreshedConfig = await _configManager.GetConfigurationAsync(ct);
            }
            catch (Exception fetchEx)
            {
                throw new InvalidOperationException(
                    "Failed to retrieve refreshed Apple JWKS configuration.", fetchEx);
            }

            var refreshedParams = new TokenValidationParameters
            {
                ValidIssuer = AppleIssuer,
                ValidAudience = clientId,
                ValidAlgorithms = ["RS256"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5),
                IssuerSigningKeys = refreshedConfig.SigningKeys,
                ValidateIssuerSigningKey = true,
                ValidateIssuer = true,
                ValidateAudience = true
            };

            try
            {
                principal = _tokenHandler.ValidateToken(identityToken, refreshedParams, out _);
            }
            catch (SecurityTokenException retryEx)
            {
                throw new InvalidOperationException(
                    "Apple identity token validation failed after JWKS refresh.", retryEx);
            }

            // Suppress the original exception — the retry succeeded.
            _ = ex;
        }

        // Extract claims from the validated token.
        var sub = principal.FindFirstValue("sub")
            ?? throw new InvalidOperationException("Apple identity token is missing the 'sub' claim.");

        var email = principal.FindFirstValue("email");

        // email_verified and is_private_email are serialized as STRING ("true"/"false") by Apple,
        // but the OIDC spec allows boolean too. Parse tolerantly.
        var emailVerifiedClaim = principal.FindFirstValue("email_verified");
        var emailVerified = ParseBoolClaim(emailVerifiedClaim);

        var isPrivateEmailClaim = principal.FindFirstValue("is_private_email");
        var isPrivateEmail = ParseBoolClaim(isPrivateEmailClaim);

        // Security gate: reject tokens where the email is present, is NOT a private-relay
        // address, AND is explicitly marked as unverified. Private-relay addresses are always
        // considered safe (Apple controls them). Absent email is allowed (re-auth flow).
        if (email is not null && !isPrivateEmail && !emailVerified)
        {
            throw new InvalidOperationException(
                "Apple identity token email is explicitly unverified and is not a private-relay address.");
        }

        // Nonce verification: Apple embeds SHA-256(rawNonce) in the token's "nonce" claim (lowercase hex).
        // Reject the token if the claim is absent or does not match SHA-256(expectedNonce).
        var nonceClaim = principal.FindFirstValue("nonce");
        if (string.IsNullOrEmpty(nonceClaim))
        {
            throw new InvalidOperationException(
                "Apple identity token is missing the 'nonce' claim. The sign-in must embed a nonce.");
        }

        var expectedNonceHash = ComputeSha256Hex(expectedNonce);
        if (!string.Equals(nonceClaim, expectedNonceHash, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Apple identity token nonce claim does not match the expected nonce. Possible replay attack.");
        }

        return new AppleTokenPayload(
            Subject: sub,
            Email: email,
            EmailVerified: emailVerified || isPrivateEmail,
            IsPrivateEmail: isPrivateEmail);
    }

    /// <summary>
    /// Computes the lowercase hex-encoded SHA-256 hash of the UTF-8 encoding of <paramref name="input"/>.
    /// Apple embeds this value in the identity token's <c>nonce</c> claim.
    /// </summary>
    internal static string ComputeSha256Hex(string input)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>
    /// Parses an Apple claim value that may be a JSON boolean or a string "true"/"false".
    /// Returns false when the claim is absent or unrecognized.
    /// </summary>
    private static bool ParseBoolClaim(string? value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        if (bool.TryParse(value, out var result)) return result;
        // Some Apple tokens serialize as "TRUE"/"FALSE" — handle case-insensitively.
        return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);
    }
}
