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

namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Google;

/// <summary>
/// Endpoint for signing in via Google Identity Services.
/// Verifies the Google ID token, then either logs in an existing linked account,
/// provisions a new account from the Google profile, or returns 409 when the
/// email belongs to a password-only account with no Google link.
/// </summary>
public class GoogleSocialLoginEndpoint(
    IGoogleTokenVerifier googleVerifier,
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    IConfiguration config) : Endpoint<GoogleSocialLoginRequest, GoogleSocialLoginResponse>
{
    private const string GoogleProvider = "google";

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/social/google");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Google social login";
            s.Description = "Verifies a Google ID token and returns platform JWT tokens. Provisions a new account if the email is not yet registered.";
            s.Response<GoogleSocialLoginResponse>(200, "Login successful");
            s.Responses[400] = "idToken is missing or empty";
            s.Responses[401] = "Google ID token is invalid, expired, or has wrong audience";
            s.Responses[403] = "Account is deactivated";
            s.Responses[409] = "Email belongs to an existing password-only account (social_email_conflict)";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GoogleSocialLoginRequest req, CancellationToken ct)
    {
        // 1. Verify the Google ID token (throws on failure).
        GoogleTokenPayload googlePayload;
        try
        {
            googlePayload = await googleVerifier.VerifyAsync(req.IdToken, ct);
        }
        catch (InvalidOperationException)
        {
            await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                ErrorCodes.InvalidCredentials,
                "Google ID token is invalid, expired, or has the wrong audience.",
                ct);
            return;
        }

        // 2. Look up the UserExternalLogin row for (google, sub).
        var externalLogin = await db.UserExternalLogins
            .FirstOrDefaultAsync(
                el => el.Provider == GoogleProvider && el.Subject == googlePayload.Subject,
                ct);

        ApplicationUser user;

        if (externalLogin is not null)
        {
            // Happy path A: existing Google link found — load the linked user.
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
            // No Google link yet. Check by email.
            var existingUser = await userManager.FindByEmailAsync(googlePayload.Email);

            if (existingUser is not null)
            {
                // Email exists but no Google link — this is a password-only account.
                // Return 409 with social_email_conflict so the web prompts the user
                // to sign in with their password instead.
                await this.SendProblemAsync(StatusCodes.Status409Conflict,
                    ErrorCodes.SocialEmailConflict,
                    "An account with this email already exists. Please sign in with your password.",
                    ct);
                return;
            }

            // Happy path B: new user — provision from Google profile.
            var nameParts = (googlePayload.Name ?? googlePayload.Email).Split(' ', 2);
            var firstName = nameParts[0];
            var lastName = nameParts.Length > 1 ? nameParts[1] : string.Empty;

            var newUser = new ApplicationUser
            {
                UserName = googlePayload.Email,
                Email = googlePayload.Email,
                EmailConfirmed = true, // Google has already verified the email.
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

            // Link the Google identity.
            db.UserExternalLogins.Add(new UserExternalLogin
            {
                UserId = newUser.Id,
                Provider = GoogleProvider,
                Subject = googlePayload.Subject,
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

        // 4. Issue tokens (same logic as LoginEndpoint).
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

        await Send.OkAsync(new GoogleSocialLoginResponse
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
