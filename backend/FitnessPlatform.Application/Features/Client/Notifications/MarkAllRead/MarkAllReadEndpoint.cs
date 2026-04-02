using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Notifications.MarkAllRead;

/// <summary>
/// Marks all unread notifications as read for the authenticated client.
/// </summary>
public class MarkAllReadEndpoint(IApplicationDbContext db) : EndpointWithoutRequest
{
    public override void Configure()
    {
        Post("/client/notifications/read-all");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark all notifications as read";
            s.Description = "Marks all unread notifications as read for the authenticated client.";
        });
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        await db.Notifications
            .Where(n => n.RecipientUserId == userGuid && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);

        await Send.NoContentAsync(ct);
    }
}
