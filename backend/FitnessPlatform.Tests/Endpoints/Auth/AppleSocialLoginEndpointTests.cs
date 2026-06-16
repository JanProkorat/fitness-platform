using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Auth.SocialLogin.Apple;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Unit tests for <see cref="AppleSocialLoginEndpoint"/>.
/// A fake <see cref="IAppleTokenVerifier"/> is injected so no real Apple
/// network calls are made.
/// </summary>
public class AppleSocialLoginEndpointTests
{
    private static readonly string JwtSecret = new('x', 64);

    // Raw nonce used in all tests — the DB is seeded with a valid record for this value.
    private const string ValidNonce = "test-raw-nonce-apple";

    // Shared Apple token payload returned by the fake verifier — verified email, not private-relay.
    private static readonly AppleTokenPayload ValidPayloadWithEmail = new(
        Subject: "apple-sub-12345",
        Email: "appleuser@example.com",
        EmailVerified: true,
        IsPrivateEmail: false);

    // Payload simulating a private-relay email (first auth with hidden real email).
    private static readonly AppleTokenPayload PrivateRelayPayload = new(
        Subject: "apple-sub-67890",
        Email: "abc123@privaterelay.appleid.com",
        EmailVerified: true,
        IsPrivateEmail: true);

    // Payload simulating a returning user (Apple omits email after first auth).
    private static readonly AppleTokenPayload ReturningUserPayload = new(
        Subject: "apple-sub-12345",
        Email: null,
        EmailVerified: false,
        IsPrivateEmail: false);

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
    private static IAppleTokenVerifier MakeVerifier(AppleTokenPayload payload)
    {
        var verifier = Substitute.For<IAppleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(payload);
        return verifier;
    }

    private static IAppleTokenVerifier MakeFailingVerifier()
    {
        var verifier = Substitute.For<IAppleTokenVerifier>();
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

    // ── 400 — FluentValidation rejects missing identityToken ─────────────────

    [Fact]
    public void Validator_EmptyIdentityToken_HasValidationError()
    {
        var validator = new AppleSocialLoginValidator();
        var result = validator.Validate(new AppleSocialLoginRequest { IdentityToken = "", Nonce = "some-nonce" });
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => string.Equals(
            e.PropertyName, nameof(AppleSocialLoginRequest.IdentityToken),
            StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validator_NullIdentityToken_HasValidationError()
    {
        var validator = new AppleSocialLoginValidator();
        var result = validator.Validate(new AppleSocialLoginRequest { IdentityToken = null!, Nonce = "some-nonce" });
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_EmptyNonce_HasValidationError()
    {
        var validator = new AppleSocialLoginValidator();
        var result = validator.Validate(new AppleSocialLoginRequest { IdentityToken = "token", Nonce = "" });
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => string.Equals(
            e.PropertyName, nameof(AppleSocialLoginRequest.Nonce),
            StringComparison.OrdinalIgnoreCase));
    }

    // ── 401 — nonce not found in DB ───────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NonceNotFound_Returns401()
    {
        // DB has no nonce rows — any nonce value is unknown.
        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build(); // no nonce rows
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = "unknown-nonce" },
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

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(consumedNonce).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
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

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(expiredNonce).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await verifier.DidNotReceive().VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // ── 401 — invalid Apple token ─────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_InvalidAppleToken_Returns401()
    {
        // Arrange — nonce is valid but verifier rejects the token.
        var verifier = MakeFailingVerifier();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — SendProblemAsync writes the response; it does NOT throw.
        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "bad-token", Nonce = ValidNonce },
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
        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        // Override the default return: atomic consume lost the race.
        db.ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(0);
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — must be 401; no user lookup / provisioning should have occurred.
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await userManager.DidNotReceive().FindByIdAsync(Arg.Any<string>());
        await userManager.DidNotReceive().FindByEmailAsync(Arg.Any<string>());
    }

    /// <summary>
    /// Verifier throws when token uses alg=none or HS256 — endpoint must return 401.
    /// The ValidAlgorithms=["RS256"] guard inside AppleTokenVerifier rejects these;
    /// the endpoint maps any InvalidOperationException to 401 invalid_credentials.
    /// Critically: the nonce must NOT be consumed when token verification fails.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifierThrowsForAlgConfusion_Returns401()
    {
        // Arrange — simulate the exception raised by alg-confusion guard
        var verifier = Substitute.For<IAppleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException(
                "Apple identity token validation failed after JWKS refresh."));

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "alg-none-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — must be 401, not 200/409/403; nonce must not be burned on failed token verification.
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Verifier throws when email is explicitly unverified and not a private-relay address.
    /// The endpoint maps this InvalidOperationException to 401 invalid_credentials.
    /// Critically: the nonce must NOT be consumed when token verification fails.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifierThrowsForUnverifiedNonRelayEmail_Returns401()
    {
        var verifier = Substitute.For<IAppleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException(
                "Apple identity token email is explicitly unverified and is not a private-relay address."));

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "unverified-email-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Verifier throws when the nonce claim in the token does not match the expected nonce.
    /// The endpoint maps this to 401 — same as any other InvalidOperationException from the verifier.
    /// Critically: the nonce must NOT be consumed when token verification fails.
    /// </summary>
    [Fact]
    public async Task HandleAsync_VerifierThrowsForNonceMismatch_Returns401()
    {
        var verifier = Substitute.For<IAppleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException(
                "Apple identity token nonce claim does not match the expected nonce. Possible replay attack."));

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().With(MakeValidNonce()).Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "replay-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        await db.DidNotReceive().ConsumeNonceAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // ── 401 — orphaned external login ─────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_OrphanedExternalLogin_Returns401()
    {
        // Arrange — external login exists but linked user does not
        var userId = Guid.NewGuid();
        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "apple",
            Subject = ValidPayloadWithEmail.Subject
        };

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        // FindByIdAsync returns null — orphaned link
        userManager.FindByIdAsync(userId.ToString()).Returns((ApplicationUser?)null);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    // ── 422 — no link AND no email in token ───────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoLinkAndNoEmailInToken_Returns422()
    {
        // Arrange — no external login, token has no email (Apple re-auth without link)
        var verifier = MakeVerifier(ReturningUserPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build(); // no external logins
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "no-email-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — 422, not NRE or 401
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);
    }

    // ── 409 — email conflict (password-only account) ──────────────────────────

    [Fact]
    public async Task HandleAsync_ExistingPasswordOnlyAccount_Returns409WithSocialEmailConflict()
    {
        // Arrange — existing user with the verified email but NO Apple external login
        var existingUser = EntityBuilder.User
            .WithEmail(ValidPayloadWithEmail.Email!)
            .Build();

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync(ValidPayloadWithEmail.Email!).Returns(existingUser);

        // No UserExternalLogin rows in the DB.
        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    // ── 403 — deactivated account ─────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_DeactivatedAccount_Returns403WithAccountDeactivatedCode()
    {
        // Arrange — existing external login for this Apple subject; account inactive
        var userId = Guid.NewGuid();
        var inactiveUser = EntityBuilder.User
            .WithId(userId)
            .WithEmail(ValidPayloadWithEmail.Email!)
            .Inactive()
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "apple",
            Subject = ValidPayloadWithEmail.Subject
        };

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(userId.ToString()).Returns(inactiveUser);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    // ── 200 — happy path A: existing Apple-linked user (returning) ────────────

    [Fact]
    public async Task HandleAsync_ExistingAppleLink_ReturnsTokens()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = EntityBuilder.User
            .WithId(userId)
            .WithEmail(ValidPayloadWithEmail.Email!)
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "apple",
            Subject = ValidPayloadWithEmail.Subject
        };

        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        db.RefreshTokens.Received(1).Add(Arg.Is<RefreshToken>(rt => rt.UserId == userId));
        await db.Received().SaveChangesAsync(Arg.Any<CancellationToken>());
        // Atomic consume must have been called exactly once.
        await db.Received(1).ConsumeNonceAsync(ValidNonce, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Happy path A variant: re-auth where token carries no email.
    /// The existing (apple, sub) link must be found, and the user's stored name
    /// must NOT be overwritten by the absent body values.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExistingAppleLinkNoEmailInToken_ReturnsTokens_AndIgnoresAbsentBodyName()
    {
        // Arrange — returning user; token has no email; no name in body
        var userId = Guid.NewGuid();
        var user = EntityBuilder.User
            .WithId(userId)
            .WithEmail("stored@example.com")
            .Build();

        var externalLogin = new UserExternalLogin
        {
            UserId = userId,
            Provider = "apple",
            Subject = ReturningUserPayload.Subject
        };

        var verifier = MakeVerifier(ReturningUserPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — no FirstName/LastName in body
        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        // Assert — tokens returned; no name update attempted on userManager
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        // We must NOT have called UpdateAsync on the user (no name overwrite)
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    // ── 200 — happy path B: new user provisioning with private-relay email ────

    [Fact]
    public async Task HandleAsync_NewUserWithPrivateRelayEmail_ProvisionesAccountAndReturnsTokens()
    {
        // Arrange — no existing user or external login; Apple private-relay email
        var verifier = MakeVerifier(PrivateRelayPayload);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        // FindByEmailAsync returns null → no existing account
        userManager.FindByEmailAsync(PrivateRelayPayload.Email!).Returns((ApplicationUser?)null);

        // CreateAsync succeeds and sets up the user object
        userManager.CreateAsync(Arg.Any<ApplicationUser>())
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);

        userManager.AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Trainer)
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);

        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — name from body (first auth)
        await ep.HandleAsync(
            new AppleSocialLoginRequest
            {
                IdentityToken = "valid-token",
                FirstName = "Anna",
                LastName = "Smith",
                Nonce = ValidNonce
            },
            CancellationToken.None);

        // Assert
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.EmailConfirmed.Should().BeTrue(); // Apple verified it

        // Provisioned user must have FirstName/LastName from the body
        await userManager.Received(1).CreateAsync(
            Arg.Is<ApplicationUser>(u =>
                u.FirstName == "Anna" &&
                u.LastName == "Smith" &&
                u.EmailConfirmed == true &&
                u.Email == PrivateRelayPayload.Email));

        // A UserExternalLogin row must have been added for apple
        db.UserExternalLogins.Received(1).Add(Arg.Is<UserExternalLogin>(el =>
            el.Provider == "apple" && el.Subject == PrivateRelayPayload.Subject));

        // A ProfessionalProfile must have been created (Trainer role provisioning)
        db.ProfessionalProfiles.Received(1).Add(Arg.Any<ProfessionalProfile>());
    }

    /// <summary>
    /// Happy path B variant: new user with no name in body.
    /// FirstName and LastName must fall back to empty string, never null
    /// (ApplicationUser.FirstName/LastName are non-null string fields).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NewUserNoNameInBody_ProvisionesWithEmptyStrings()
    {
        var verifier = MakeVerifier(ValidPayloadWithEmail);
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        userManager.FindByEmailAsync(ValidPayloadWithEmail.Email!).Returns((ApplicationUser?)null);
        userManager.CreateAsync(Arg.Any<ApplicationUser>())
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);
        userManager.AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Trainer)
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Trainer"]);

        var db = new MockDbBuilder()
            .With(MakeValidNonce())
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<AppleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — no name in body (Apple omitted on first auth for this test)
        await ep.HandleAsync(
            new AppleSocialLoginRequest { IdentityToken = "valid-token", Nonce = ValidNonce },
            CancellationToken.None);

        ep.ValidationFailed.Should().BeFalse();

        // Name fields must be empty strings, not null
        await userManager.Received(1).CreateAsync(
            Arg.Is<ApplicationUser>(u =>
                u.FirstName == string.Empty &&
                u.LastName == string.Empty));
    }
}
