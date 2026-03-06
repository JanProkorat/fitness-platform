using System.Security.Cryptography;
using FastEndpoints;
using FastEndpoints.Security;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.RefreshToken;

/// <summary>
/// Endpoint for rotating a refresh token and issuing a new access + refresh token pair.
/// The old refresh token is invalidated upon use.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="config">Application configuration.</param>
public class RefreshTokenEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    IConfiguration config) : Endpoint<RefreshTokenRequest, RefreshTokenResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/refresh");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Refresh access token";
            s.Description = "Exchanges a valid refresh token for a new access + refresh token pair. The old refresh token is invalidated.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RefreshTokenRequest req, CancellationToken ct)
    {
        var existingToken = await db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == req.RefreshToken, ct);

        if (existingToken is null || !existingToken.IsActive)
        {
            ThrowError("Invalid or expired refresh token.");
            return;
        }

        var user = existingToken.User;

        if (!user.IsActive)
        {
            ThrowError("Account is deactivated.");
            return;
        }

        // Revoke old token
        existingToken.RevokedAt = DateTime.UtcNow;

        // Generate new tokens
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

        var newRefreshTokenValue = GenerateRefreshToken();
        var refreshTokenDays = config.GetValue(ConfigKeys.JwtRefreshTokenExpirationDays, 7);

        existingToken.ReplacedByToken = newRefreshTokenValue;

        var newRefreshToken = new Domain.Entities.RefreshToken
        {
            UserId = user.Id,
            Token = newRefreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenDays)
        };

        db.RefreshTokens.Add(newRefreshToken);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new RefreshTokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = newRefreshTokenValue,
            ExpiresAt = expiresAt
        }, ct);
    }

    /// <summary>
    /// Generates a cryptographically secure random refresh token string.
    /// </summary>
    /// <returns>A base64-encoded random token.</returns>
    private static string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }
}
