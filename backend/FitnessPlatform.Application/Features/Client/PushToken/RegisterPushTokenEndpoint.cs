using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.PushToken;

/// <summary>
/// Registers or updates an Expo push token for the authenticated user's device.
/// </summary>
public class RegisterPushTokenEndpoint(IApplicationDbContext db) : Endpoint<RegisterPushTokenRequest>
{
    public override void Configure()
    {
        Post("/client/push-token");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Register push token";
            s.Description = "Registers or updates an Expo push token for the authenticated user's device.";
        });
    }

    public override async Task HandleAsync(RegisterPushTokenRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        // Upsert: if this token already exists for this user, update the platform
        var existing = await db.DevicePushTokens
            .FirstOrDefaultAsync(t => t.UserId == userGuid && t.Token == req.Token, ct);

        if (existing is not null)
        {
            existing.Platform = req.Platform;
        }
        else
        {
            db.DevicePushTokens.Add(new DevicePushToken
            {
                UserId = userGuid,
                Token = req.Token,
                Platform = req.Platform
            });
        }

        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

public class RegisterPushTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
}
