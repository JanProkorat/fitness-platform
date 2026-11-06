using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Features.Client.PushToken.RemovePushTokenAnonymous;

/// <summary>
/// Removes an Expo push token by value so a signed-out device stops receiving pushes.
/// </summary>
/// <param name="db">Database context.</param>
internal sealed class RemovePushTokenAnonymousEndpoint(IApplicationDbContext db)
    : Endpoint<RemovePushTokenAnonymousRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/push-token/remove");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.PushTokenRemoveRateLimit));
        Summary(s =>
        {
            s.Summary = "Remove push token";
            s.Description = "Anonymous on purpose: logout runs after the access token may have expired, and the token value identifies the device install. Deletes every row holding the token, for any account. Always 204 with no body, whether or not the token existed.";
            s.Responses[StatusCodes.Status204NoContent] = "Token removed or not present";
            s.Response<ProblemDetails>(StatusCodes.Status400BadRequest, "Token is empty, too long or not an Expo push token");
            s.Response(StatusCodes.Status429TooManyRequests, "Rate limit exceeded");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RemovePushTokenAnonymousRequest req, CancellationToken ct)
    {
        var rows = await db.DevicePushTokens
            .Where(t => t.Token == req.Token)
            .ToListAsync(ct);

        if (rows.Count > 0)
        {
            db.DevicePushTokens.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
        }

        await Send.NoContentAsync(ct);
    }
}
