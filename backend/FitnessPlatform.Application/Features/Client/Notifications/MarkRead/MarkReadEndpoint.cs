using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Notifications.MarkRead;

/// <summary>
/// Marks a single notification as read.
/// </summary>
public class MarkReadEndpoint(IApplicationDbContext db) : Endpoint<MarkNotificationReadRequest>
{
    public override void Configure()
    {
        Post("/client/notifications/{Id}/read");
        Roles(AppRoles.Client, AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Mark notification as read";
            s.Description = "Marks a single notification as read for the authenticated client.";
        });
    }

    public override async Task HandleAsync(MarkNotificationReadRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var notification = await db.Notifications
            .FirstOrDefaultAsync(n => n.PublicId == req.Id && n.RecipientUserId == userGuid, ct);

        if (notification is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        notification.IsRead = true;
        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}

public class MarkNotificationReadRequest
{
    public Guid Id { get; set; }
}
