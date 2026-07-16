using System.Security.Cryptography;
using FastEndpoints;
using FastEndpoints.Security;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
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
    IConfiguration config,
    // Seeds a professional-client conversation against any message-bearing PendingInvite
    // already addressed to a newly-provisioned account's email (#803/#817).
    IPendingInviteConversationSeeder inviteConversationSeeder) : Endpoint<AppleSocialLoginRequest, AppleSocialLoginResponse>
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
            s.Responses[400] = "identityToken or nonce is missing or empty";
            s.Responses[401] = "Apple identity token is invalid, expired, has wrong audience, email is explicitly unverified, or the nonce is invalid/consumed/expired";
            s.Responses[403] = "Account is deactivated";
            s.Responses[409] = "Email belongs to an existing password-only account (social_email_conflict)";
            s.Responses[422] = "No Apple account link exists and token carries no email — cannot provision";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AppleSocialLoginRequest req, CancellationToken ct)
    {
        // 1. Fast pre-check: reject obviously invalid nonces before paying for token verification.
        // This path is NOT the consume step — it is a cheap short-circuit for clearly-bad nonces.
        var nonceRecord = await db.SocialLoginNonces
            .FirstOrDefaultAsync(n => n.Nonce == req.Nonce, ct);

        if (nonceRecord is null || nonceRecord.ConsumedAt != null || nonceRecord.ExpiresAt < DateTime.UtcNow)
        {
            await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                ErrorCodes.InvalidCredentials,
                "Social sign-in nonce is invalid, already used, or has expired. Request a new nonce and retry.",
                ct);
            return;
        }

        // 2. Verify the Apple identity token (throws on failure).
        // The verifier confirms the token's nonce claim equals SHA-256(req.Nonce).
        // Token verification happens BEFORE the atomic consume so that a bad token
        // does NOT burn the nonce — the client may retry with the same nonce if
        // the token itself was the problem (e.g. a transient clock skew).
        AppleTokenPayload applePayload;
        try
        {
            applePayload = await appleVerifier.VerifyAsync(req.IdentityToken, req.Nonce, ct);
        }
        catch (InvalidOperationException)
        {
            await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                ErrorCodes.InvalidCredentials,
                "Apple identity token is invalid, expired, or has the wrong audience.",
                ct);
            return;
        }

        // 3. Atomically consume the nonce with a single conditional UPDATE statement.
        // This closes the concurrent-request window: two parallel requests that both
        // passed the pre-check and both verified a valid token will race here; only
        // one UPDATE will find ConsumedAt == null, the other returns 0 rows affected.
        // The nonce is spent on every verified outcome (200, 409, 422) — it must
        // not be replayable once the identity token has been accepted.
        var consumed = await db.ConsumeNonceAsync(req.Nonce, ct);
        if (consumed == 0)
        {
            // Lost the concurrent consume race, or the nonce expired between the
            // pre-check read and the UPDATE. Either way, deny as invalid.
            await this.SendProblemAsync(StatusCodes.Status401Unauthorized,
                ErrorCodes.InvalidCredentials,
                "Social sign-in nonce is invalid, already used, or has expired. Request a new nonce and retry.",
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

            // New Apple social-login users default to the Client role.
            // The client-facing mobile app is the social-login consumer; trainers are
            // provisioned via the password register flow only. Defaulting to Trainer here
            // would allow any anonymous caller with a valid Apple token to gain Trainer
            // privileges — a privilege escalation on an anonymous endpoint.
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

            await userManager.AddToRoleAsync(newUser, AppRoles.Client);

            // Create the client profile (mirroring RegisterEndpoint for Client role).
            db.ClientProfiles.Add(new ClientProfile { UserId = newUser.Id });

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

            // New account (always Client role for social login) — if it matches an
            // existing message-bearing PendingInvite, seed the professional-client
            // conversation now instead of waiting for the client to accept (#803/#817).
            await inviteConversationSeeder.SeedForNewUserAsync(newUser, ct);
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
