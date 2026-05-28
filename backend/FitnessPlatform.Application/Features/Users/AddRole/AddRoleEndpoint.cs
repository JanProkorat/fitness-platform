using System.Security.Cryptography;
using FastEndpoints;
using FastEndpoints.Security;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.AddRole;

/// <summary>
/// Endpoint that allows a Trainer or Nutritionist to add the other professional role to their account.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="db">Database context.</param>
/// <param name="config">Application configuration for JWT settings.</param>
/// <param name="audit">Audit logging service.</param>
public class AddRoleEndpoint(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    IConfiguration config,
    IAuditService audit) : Endpoint<AddRoleRequest, AddRoleResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/users/me/roles");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Add a professional role";
            s.Description = "Allows a Trainer to also become a Nutritionist, or vice versa. Returns fresh tokens with updated roles.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddRoleRequest req, CancellationToken ct)
    {
        var userIdString = User.FindFirst(AppClaims.UserId)?.Value;
        if (userIdString is null || !Guid.TryParse(userIdString, out var userId))
        {
            ThrowError("Invalid user identity.");
            return;
        }

        // Defense-in-depth: handler-level guard mirrors AddRoleValidator so that
        // a validator bypass (wiring change, validator replacement) cannot re-open
        // the Admin self-promotion path. Both this guard and the validator must be
        // widened simultaneously — that's the invariant. See SelfAssignableRoles
        // for the rationale and issue #308.
        if (!SelfAssignableRoles.Contains(req.Role))
        {
            ThrowError(r => r.Role, "Role is not self-assignable.", 400);
            return;
        }

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            ThrowError("User not found.");
            return;
        }

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Contains(req.Role))
        {
            this.ThrowErrorWithCode(ErrorCodes.RoleAlreadyAssigned, "You already have this role.");
            return;
        }

        await userManager.AddToRoleAsync(user, req.Role);

        // If user doesn't have a ProfessionalProfile yet, create one (Nutritionist → Trainer case)
        var hasProfile = await db.ProfessionalProfiles.AnyAsync(p => p.UserId == userId, ct);
        if (!hasProfile)
        {
            db.ProfessionalProfiles.Add(new ProfessionalProfile { UserId = userId });
            await db.SaveChangesAsync(ct);
        }

        // Audit log
        await audit.LogAsync(
            userId,
            "AddRole",
            nameof(ApplicationUser),
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"addedRole\":\"{req.Role}\"}}",
            ct: ct);

        // Generate fresh tokens with updated roles
        var updatedRoles = await userManager.GetRolesAsync(user);
        var expiresAt = DateTime.UtcNow.AddMinutes(
            config.GetValue(ConfigKeys.JwtAccessTokenExpirationMinutes, 15));

        var accessToken = JwtBearer.CreateToken(o =>
        {
            o.SigningKey = config[ConfigKeys.JwtSecret]!;
            o.ExpireAt = expiresAt;
            o.User.Roles.AddRange(updatedRoles);
            o.User.Claims.Add((AppClaims.UserId, user.Id.ToString()));
            o.User.Claims.Add((AppClaims.Email, user.Email!));
        });

        var refreshTokenValue = GenerateRefreshToken();
        var refreshTokenDays = config.GetValue(ConfigKeys.JwtRefreshTokenExpirationDays, 7);

        var refreshToken = new Domain.Entities.RefreshToken
        {
            UserId = user.Id,
            Token = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenDays)
        };

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new AddRoleResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshTokenValue,
            ExpiresAt = expiresAt,
            AddedRole = req.Role
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
