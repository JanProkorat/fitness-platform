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

    private static IGoogleTokenVerifier MakeVerifier(GoogleTokenPayload payload)
    {
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(payload);
        return verifier;
    }

    private static IGoogleTokenVerifier MakeFailingVerifier()
    {
        var verifier = Substitute.For<IGoogleTokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Token invalid"));
        return verifier;
    }

    // ── 400 — FluentValidation rejects missing idToken ────────────────────
    // This path is enforced by the validator before HandleAsync is reached.
    // We verify the validator rejects an empty token directly.

    [Fact]
    public void Validator_EmptyIdToken_HasValidationError()
    {
        var validator = new GoogleSocialLoginValidator();
        var result = validator.Validate(new GoogleSocialLoginRequest { IdToken = "" });
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(GoogleSocialLoginRequest.IdToken));
    }

    [Fact]
    public void Validator_NullIdToken_HasValidationError()
    {
        var validator = new GoogleSocialLoginValidator();
        var result = validator.Validate(new GoogleSocialLoginRequest { IdToken = null! });
        result.IsValid.Should().BeFalse();
    }

    // ── 401 — invalid Google token ─────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_InvalidGoogleToken_Returns401()
    {
        // Arrange
        var verifier = MakeFailingVerifier();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act — SendProblemAsync writes the response; it does NOT throw.
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "bad-token" },
            CancellationToken.None);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    // ── 403 — deactivated account ──────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_DeactivatedAccount_ThrowsAccountDeactivatedError()
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
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        var act = () => ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token" },
            CancellationToken.None);

        // Assert — ThrowErrorWithCode raises a ValidationFailureException with the ACCOUNT_DEACTIVATED code.
        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should().Contain(f => f.ErrorCode == ErrorCodes.AccountDeactivated);
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
        var db = new MockDbBuilder().Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token" },
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
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token" },
            CancellationToken.None);

        // Assert
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        db.RefreshTokens.Received(1).Add(Arg.Is<RefreshToken>(rt => rt.UserId == userId));
        await db.Received().SaveChangesAsync(Arg.Any<CancellationToken>());
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

        userManager.AddToRoleAsync(Arg.Any<ApplicationUser>(), AppRoles.Trainer)
            .Returns(Microsoft.AspNetCore.Identity.IdentityResult.Success);

        // GetRolesAsync needs to return roles for token creation
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Trainer"]);

        var db = new MockDbBuilder().Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token" },
            CancellationToken.None);

        // Assert
        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.EmailConfirmed.Should().BeTrue(); // Google verified the email

        // A UserExternalLogin row must have been added
        db.UserExternalLogins.Received(1).Add(Arg.Is<UserExternalLogin>(el =>
            el.Provider == "google" && el.Subject == ValidPayload.Subject));

        // A ProfessionalProfile must have been created (Trainer role provisioning)
        db.ProfessionalProfiles.Received(1).Add(Arg.Any<ProfessionalProfile>());
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
            .With(externalLogin)
            .Build();
        var config = MakeConfig();
        var ep = Factory.Create<GoogleSocialLoginEndpoint>(verifier, userManager, db, config);

        // Act
        await ep.HandleAsync(
            new GoogleSocialLoginRequest { IdToken = "valid-token" },
            CancellationToken.None);

        // Assert — no 409; returns tokens
        ep.ValidationFailed.Should().BeFalse();
        ep.HttpContext.Response.StatusCode.Should().NotBe(StatusCodes.Status409Conflict);
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
    }
}
