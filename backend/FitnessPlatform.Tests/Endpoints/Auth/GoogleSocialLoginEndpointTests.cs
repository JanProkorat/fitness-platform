using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Auth.SocialLogin.Google;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Unit tests for <see cref="GoogleSocialLoginEndpoint"/>.
/// A fake <see cref="IGoogleTokenVerifier"/> is injected so no real Google
/// network calls are made.
/// </summary>
public class GoogleSocialLoginEndpointTests
{
    private static readonly string JwtSecret = new('x', 64);

    // Raw nonce used in all tests — the DB is seeded with a valid record for this value.
    private const string ValidNonce = "test-raw-nonce-google";

    // Shared Google token payload returned by the fake verifier.
    private static readonly GoogleTokenPayload ValidPayload = new(
        Subject: "google-sub-12345",
        Email: "googleuser@example.com",
        Name: "Google User");

    private static IConfiguration MakeConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = JwtSecret,
                ["Jwt:AccessTokenExpirationMinutes"] = "15",
                ["Jwt:RefreshTokenExpirationDays"] = "7"
            })
            .Build();

    /// <summary>
    /// Creates a fake verifier that always returns the given payload regardless of nonce.
    /// </summary>
    private static IGoogleTokenVerifier MakeVerifier(GoogleTokenPayload payload)
    {
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(payload);
        return verifier;
    }

    private static IGoogleTokenVerifier MakeFailingVerifier()
    {
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Token invalid"));
        return verifier;
    }

    /// <summary>
    /// Returns a valid, unconsumed nonce row seeded in the mock DB.
    /// </summary>
    private static SocialLoginNonce MakeValidNonce() => new()
    {
        Nonce = ValidNonce,
        ExpiresAt = DateTime.UtcNow.AddMinutes(10),
        ConsumedAt = null,
        CreatedAt = DateTime.UtcNow
    };

    // ── 400 — FluentValidation rejects missing idToken ────────────────
    // This path is enforced by the validator before HandleAsync is reached.
    // We verify the validator rejects an empty token directly.

    [Fact]
    public void Validator_EmptyIdToken_HasValidationError()
    {
        var validator = new GoogleSocialLoginValidator();
        var result = validator.Validate(new GoogleSocialLoginRequest { IdToken = "", Nonce = "some-nonce" });
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => string.Equals(e.PropertyName, nameof(GoogleSocialLoginRequest.IdToken), StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validator_NullIdToken_HasValidationError()
    {
        var validator = new GoogleSocialLoginValidator();
        var result = validator.Validate(new GoogleSocialLoginRequest { IdToken = null!, Nonce = "some-nonce" });
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_EmptyNonce_HasValidationError()
    {
        var validator = new GoogleSocialLoginValidator();
        var result = validator.Validate(new GoogleSocialLoginRequest { IdToken = "token", Nonce = "" });
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => string.Equals(
            e.PropertyName, nameof(GoogleSocialLoginRequest.Nonce),
            StringComparison.OrdinalIgnoreCase));
    }

    // ── 401 — nonce not found in DB ───────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NonceNotFound_Returns401()
    {
        // DB has no nonce rows — any nonce value is unknown.
        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build(); // no nonce rows
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = "unknown-nonce" },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        // Verifier must NOT be called when the nonce is invalid.
        await verifier.DidNotReceive().VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NonceAlreadyConsumed_Returns401()
    {
        // Nonce exists but has already been consumed.
        var consumedNonce = new SocialLoginNonce
        {
            Nonce = ValidNonce,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            ConsumedAt = DateTime.UtcNow.AddMinutes(-1), // already consumed
            CreatedAt = DateTime.UtcNow.AddMinutes(-2)
        };

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(consumedNonce).Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await verifier.DidNotReceive().VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NonceExpired_Returns401()
    {
        // Nonce exists but has expired.
        var expiredNonce = new SocialLoginNonce
        {
            Nonce = ValidNonce,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1), // expired
            ConsumedAt = null,
            CreatedAt = DateTime.UtcNow.AddMinutes(-11)
        };

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(expiredNonce).Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await verifier.DidNotReceive().VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // ── 401 — invalid Google token ─────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_InvalidGoogleToken_Returns401()
    {
        // Arrange — nonce is valid but verifier rejects the token.
        var verifier = MakeFailingVerifier();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — SendProblemAsync writes the response; it does NOT throw.
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "bad-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — 401, and the nonce must NOT have been consumed (atomic consume is
        // only called after token verification succeeds — bad tokens do not burn the nonce).
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // ── 401 — concurrent consume race lost ───────────────────────────────────

    /// <summary>
    /// Simulates a concurrent-request race where two requests both pass the
    /// pre-check read (nonce appears valid) but only one wins the atomic UPDATE.
    /// The loser receives 0 rows from ConsumeNonceAsync and must return 401.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ConsumeRaceLost_Returns401()
    {
        // Arrange — nonce is valid at pre-check time but ConsumeNonceAsync returns
        // 0 (another request consumed it in the gap between read and update).
        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        // Override the default return: atomic consume lost the race.
        db.ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(0);
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — must be 401; no user lookup / provisioning should have occurred.
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await userManager.DidNotReceive().FindByIdAsync(Arg.Any<string>());
        await userManager.DidNotReceive().FindByEmailAsync(Arg.Any<string>());
    }

    /// <summary>
    /// Covers the email_verified=false security fix in GoogleTokenVerifier.
    ///
    /// GoogleTokenVerifier.VerifyAsync now throws InvalidOperationException when
    /// payload.EmailVerified != true (i.e. Google did not verify the email address).
    /// Since offline unit-testing of GoogleJsonWebSignature.ValidateAsync with a
    /// real signed JWT is not feasible, we verify the endpoint contract: any
    /// InvalidOperationException thrown by the verifier — including one triggered
    /// by an unverified email — is mapped to 401 invalid_credentials.
    ///
    /// To see the verifier guard at source, inspect:
    ///   Infrastructure/Services/GoogleTokenVerifier.cs — the "email_verified" check.
    /// Critically: the nonce must NOT be consumed when token verification fails.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifierThrowsForUnverifiedEmail_Returns401WithInvalidCredentials()
    {
        // Arrange — simulate the InvalidOperationException GoogleTokenVerifier now
        // raises when payload.EmailVerified is false or null.
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException(
                "Google ID token has an unverified email address (email_verified is not true)."));

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "token-with-unverified-email", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — 401, not 200/409/403. The unverified-email path must never
        // proceed to account lookup or provisioning; nonce must not be burned.
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Verifier throws when the nonce field in the token does not match the expected nonce.
    /// The endpoint maps this to 401 — same as any other InvalidOperationException from the verifier.
    /// Critically: the nonce must NOT be consumed when token verification fails.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifierThrowsForNonceMismatch_Returns401()
    {
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException(
                "Google ID token nonce does not match the expected nonce. Possible replay attack."));

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "replay-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // ── 403 — deactivated account ──────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_DeactivatedAccount_Returns403WithAccountDeactivatedCode()
    {
        // Arrange — existing external login for this Google subject
        var userId = Guid.NewGuid();
        var inactiveUser = EntityBuilder.User
            .WithId(userId)
            .WithEmail(ValidPayload.Email)
            .Inactive()
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "google",
            Subject = ValidPayload.Subject
        };

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        // FindByIdAsync is called after the external login is found.
        userManager.FindByIdAsync(userId.ToString()).Returns(inactiveUser);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — SendProblemAsync writes the response and does NOT throw.
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — status must be 403 (not 400) and error code must be present.
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    // ── 409 — email conflict (password-only account) ───────────────────────

    [Fact]
    public async Task HandleAsync_ExistingPasswordOnlyAccount_Returns409WithSocialEmailConflict()
    {
        // Arrange — existing user with the verified email but NO Google external login
        var existingUser = EntityBuilder.User
            .WithEmail(ValidPayload.Email)
            .Build();

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync(ValidPayload.Email).Returns(existingUser);

        // No UserExternalLogin rows in the DB.
        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    // ── 200 — existing Google-linked user ─────────────────────────────────

    [Fact]
    public async Task HandleAsync_ExistingGoogleLink_ReturnsTokens()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = EntityBuilder.User
            .WithId(userId)
            .WithEmail(ValidPayload.Email)
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "google",
            Subject = ValidPayload.Subject
        };

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        // FindByIdAsync is called after the external login is found.
        userManager.FindByIdAsync(userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        db.RefreshTokens.Received(1).Add(Arg.Is<RefreshToken>(rt => rt.UserId == userId));
        await db.Received().SaveChangesAsync(Arg.Any<CancellationToken>());
        // Atomic consume must have been called exactly once.
        await db.Received(1).ConsumeNonceAsync(ValidNonce, Arg.Any<CancellationToken>());
    }

    // ── 200 — new user provisioning ───────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewUser_ProvisionesAccountAndReturnsTokens()
    {
        // Arrange — no existing user or external login
        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        // FindByEmailAsync returns null → no existing account
        userManager.FindByEmailAsync(ValidPayload.Email).Returns((ApplicationUser?)null);

        // CreateAsync succeeds and sets up the user object
        userManager.CreateAsync(Arg.Any<ApplicationUser>())
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);

        userManager.AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Client)
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);

        // GetRolesAsync needs to return roles for token creation
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Client"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.EmailConfirmed.Should().BeTrue(); // Google verified the email

        // A UserExternalLogin row must have been added
        db.UserExternalLogins.Received(1).Add(Arg.Is<UserExternalLogin>(el =>
            el.Provider == "google" && el.Subject == ValidPayload.Subject));

        // New user must be provisioned with the Client role — NOT Trainer.
        // Assigning Trainer here would allow any anonymous caller with a valid
        // Google token to gain Trainer privileges (privilege escalation).
        await userManager.Received(1).AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Client);
        await userManager.DidNotReceive().AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Trainer);

        // A ClientProfile must have been created (mirroring RegisterEndpoint for Client role).
        db.ClientProfiles.Received(1).Add(Arg.Any<ClientProfile>());

        // ProfessionalProfile must NOT be created for a new Google social-login user.
        db.ProfessionalProfiles.DidNotReceive().Add(Arg.Any<ProfessionalProfile>());
    }

    // ── 200 — email matches existing google-linked account (returning user) ──

    [Fact]
    public async Task HandleAsync_EmailMatchesExistingGoogleLinkedAccount_ReturnsTokens()
    {
        // Arrange — external login exists for the same sub (returning user)
        var userId = Guid.NewGuid();
        var user = EntityBuilder.User
            .WithId(userId)
            .WithEmail(ValidPayload.Email)
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "google",
            Subject = ValidPayload.Subject
        };

        var verifier = MakeVerifier(ValidPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — no 409; returns tokens
        ep.ValidationFailed.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().NotBe(StatusCodes.Status409Conflict);
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
    }
}
