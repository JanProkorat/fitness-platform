using System.Security.Cryptography;
using FastEndpoints;
using FastEndpoints.Security;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Apple;

/// <summary>
/// Endpoint for signing in via Apple Sign-In.
/// Verifies the Apple identity token, then either logs in an existing linked account,
/// provisions a new account from the Apple profile, or returns 409 when the
/// email belongs to a password-only account with no Apple link.
/// <para>
/// Apple-specific behaviour: the identity token may omit email/name after first
/// authorization. The (apple, sub) link is therefore checked BEFORE any email use
/// to handle re-auth without email in the token.
/// </para>
/// </summary>
public class AppleSocialLoginEndpoint(
    IAppleTokenVerifier appleVerifier,
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    IConfiguration config) : Endpoint<AppleSocialLoginRequest, AppleSocialLoginResponse>
{
    private const string AppleProvider = "apple";

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/social/apple");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Apple Sign-In";
            s.Description = "Verifies an Apple identity token and returns platform JWT tokens. Provisions a new account if the email is not yet registered.";
            s.Response<AppleSocialLoginResponse>(200, "Login successful");
            s.Responses[400] = "identityToken is missing or empty";
            s.Responses[401] = "Apple identity token is invalid, expired, has wrong audience, or email is explicitly unverified";
            s.Responses[403] = "Account is deactivated";
            s.Responses[409] = "Email belongs to an existing password-only account (social_email_conflict)";
            s.Responses[422] = "No Apple account link exists and token carries no email — cannot provision";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AppleSocialLoginRequest req, CancellationToken ct)
    {
        // 1. Verify the Apple identity token (throws on failure).
        AppleTokenPayload applePayload;
        try
        {
            applePayload = await appleVerifier.VerifyAsync(req.IdentityToken, ct);
        }
        catch (InvalidOperationException)
        {
            await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                ErrorCodes.InvalidCredentials,
                "Apple identity token is invalid, expired, or has the wrong audience.",
                ct);
            return;
        }

        // 2. Look up the UserExternalLogin row for (apple, sub) FIRST.
        // Apple omits email/name after first auth, so the sub-based lookup is the
        // primary path for returning users.
        var externalLogin = await db.UserExternalLogins
            .FirstOrDefaultAsync(
                el => el.Provider == AppleProvider && el.Subject == applePayload.Subject,
                ct);

        ApplicationUser user;

        if (externalLogin is not null)
        {
            // Happy path A: existing Apple link found — load the linked user.
            var linkedUser = await userManager.FindByIdAsync(externalLogin.UserId.ToString());
            if (linkedUser is null)
            {
                // Orphaned external login — treat as invalid credentials.
                await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                    ErrorCodes.InvalidCredentials,
                    "Linked account not found.",
                    ct);
                return;
            }

            user = linkedUser;
        }
        else
        {
            // No Apple link yet.
            //
            // Apple can omit email after first auth — if there is no link AND no email,
            // we cannot look up or provision an account. Return a clear 422.
            if (string.IsNullOrEmpty(applePayload.Email))
            {
                await this.SendProblemAsync(StatusCodes.Status422UnprocessableEntity,
                    ErrorCodes.AppleNoEmailNoLink,
                    "Apple did not provide an email address and no linked account exists. Please sign in using Apple on the same device used during initial registration.",
                    ct);
                return;
            }

            // Check by email for an existing account.
            var existingUser = await userManager.FindByEmailAsync(applePayload.Email);

            if (existingUser is not null)
            {
                // Email exists but no Apple link — this is a password-only (or other-provider) account.
                // Return 409 so the web prompts the user to sign in with their password.
                await this.SendProblemAsync(StatusCodes.Status409Conflict,
                    ErrorCodes.SocialEmailConflict,
                    "An account with this email already exists. Please sign in with your password.",
                    ct);
                return;
            }

            // Happy path B: new user — provision from Apple profile.
            // FirstName/LastName come from the request body (Apple sends these ONLY on first auth).
            // ApplicationUser.FirstName/LastName are non-null strings — never write null.
            var firstName = req.FirstName ?? string.Empty;
            var lastName = req.LastName ?? string.Empty;

            var newUser = new ApplicationUser
            {
                UserName = applePayload.Email,
                Email = applePayload.Email,
                EmailConfirmed = true, // Apple has verified the email (including private-relay).
                FirstName = firstName,
                LastName = lastName,
                GdprConsent = true,
                GdprConsentDate = DateTime.UtcNow
            };

            // The trainer-portal register flow assigns the Trainer role by default.
            var createResult = await userManager.CreateAsync(newUser);
            if (!createResult.Succeeded)
            {
                foreach (var error in createResult.Errors)
                {
                    AddError(error.Description);
                }
                ThrowIfAnyErrors();
                return;
            }

            await userManager.AddToRoleAsync(newUser, AppRoles.Trainer);

            // Create the professional profile (mirroring RegisterEndpoint for Trainer role).
            db.ProfessionalProfiles.Add(new ProfessionalProfile { UserId = newUser.Id });

            // Link the Apple identity.
            db.UserExternalLogins.Add(new UserExternalLogin
            {
                UserId = newUser.Id,
                Provider = AppleProvider,
                Subject = applePayload.Subject,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync(ct);
            user = newUser;
        }

        // 3. Check if the account is active.
        if (!user.IsActive)
        {
            await this.SendProblemAsync(StatusCodes.Status403Forbidden,
                ErrorCodes.AccountDeactivated,
                "Account is deactivated.",
                ct);
            return;
        }

        // 4. Issue tokens (same logic as LoginEndpoint and GoogleSocialLoginEndpoint).
        var roles = await userManager.GetRolesAsync(user);
        var expiresAt = DateTime.UtcNow.AddMinutes(
            config.GetValue(ConfigKeys.JwtAccessTokenExpirationMinutes, 15));

        var accessToken = JwtBearer.CreateToken(o =>
        {
            o.SigningKey = config[ConfigKeys.JwtSecret]!;
            o.ExpireAt = expiresAt;
            o.User.Roles.AddRange(roles);
            o.User.Claims.Add((AppClaims.UserId, user.Id.ToString()));
            o.User.Claims.Add((AppClaims.Email, user.Email!));
        });

        var refreshTokenValue = GenerateRefreshToken();
        var refreshTokenDays = config.GetValue(ConfigKeys.JwtRefreshTokenExpirationDays, 7);

        db.RefreshTokens.Add(new Domain.Entities.RefreshToken
        {
            UserId = user.Id,
            Token = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenDays)
        });

        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new AppleSocialLoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenValue,
            ExpiresAt = expiresAt,
            EmailConfirmed = user.EmailConfirmed
        }, ct);
    }

    /// <summary>
    /// Generates a cryptographically secure random refresh token string.
    /// </summary>
    private static string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }
}
