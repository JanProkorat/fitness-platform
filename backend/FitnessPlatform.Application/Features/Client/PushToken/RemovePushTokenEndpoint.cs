using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.PushToken;

/// <summary>
/// Removes an Expo push token from the authenticated user's account (used on logout).
/// </summary>
/// <param name="db">Database context.</param>
public class RemovePushTokenEndpoint(IApplicationDbContext db) : Endpoint<RemovePushTokenRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/push-token");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Remove push token";
            s.Description = "Removes the given push token for the authenticated user only. Idempotent: 204 even when the token is not registered.";
            s.Responses[StatusCodes.Status204NoContent] = "Token removed or not present";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RemovePushTokenRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var userGuid = Guid.Parse(userId);

        var tokens = await db.DevicePushTokens
            .Where(t => t.UserId == userGuid && t.Token == req.Token)
            .ToListAsync(ct);

        if (tokens.Count > 0)
        {
            db.DevicePushTokens.RemoveRange(tokens);
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}

/// <summary>
/// Request for removing a push token.
/// </summary>
public class RemovePushTokenRequest
{
    /// <summary>The Expo push token to remove, sent as a query parameter.</summary>
    [QueryParam]
    public string Token { get; set; } = string.Empty;
}
