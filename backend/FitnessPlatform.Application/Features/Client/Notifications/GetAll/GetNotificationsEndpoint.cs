using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Client.Notifications.GetAll;

/// <summary>
/// Returns the authenticated client's notifications, newest first.
/// </summary>
public class GetNotificationsEndpoint(IApplicationDbContext db) : Endpoint<GetNotificationsRequest, GetNotificationsResponse>
{
    public override void Configure()
    {
        Get("/client/notifications");
        Roles(AppRoles.Client, AppRoles.Trainer, AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get client notifications";
            s.Description = "Returns notifications for the authenticated client, with cursor-based pagination.";
        });
    }

    public override async Task HandleAsync(GetNotificationsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var limit = req.Limit is > 0 and <= 50 ? req.Limit.Value : 20;

        var query = db.Notifications
            .AsNoTracking()
            .Where(n => n.RecipientUserId == userGuid)
            .OrderByDescending(n => n.DateCreated);

        if (req.Cursor.HasValue)
        {
            var cursorNotif = await db.Notifications
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.PublicId == req.Cursor.Value, ct);

            if (cursorNotif is not null)
                query = (IOrderedQueryable<Domain.Entities.Notification>)query
                    .Where(n => n.DateCreated < cursorNotif.DateCreated);
        }

        var items = await query
            .Take(limit)
            .Select(n => new NotificationDto
            {
                Id = n.PublicId.ToString(),
                Type = n.Type.ToString().ToLowerInvariant(),
                Title = n.Title,
                Body = n.Body,
                Timestamp = n.DateCreated.ToString("O"),
                Read = n.IsRead,
                ActionLabel = GetActionLabel(n.Type),
                ActionPayload = n.Data
            })
            .ToListAsync(ct);

        string? nextCursor = null;
        if (items.Count == limit)
            nextCursor = items[^1].Id;

        await Send.OkAsync(new GetNotificationsResponse { Items = items, Cursor = nextCursor }, ct);
    }

    private static string? GetActionLabel(Domain.Enums.NotificationType type) => type switch
    {
        Domain.Enums.NotificationType.InvitationReceived => "View invitation",
        Domain.Enums.NotificationType.QuestionnaireAssigned => "Open questionnaire",
        Domain.Enums.NotificationType.PlanPublished => "View plan",
        _ => null
    };
}

public class GetNotificationsRequest
{
    [QueryParam] public int? Limit { get; set; }
    [QueryParam] public Guid? Cursor { get; set; }
}

public class GetNotificationsResponse
{
    public List<NotificationDto> Items { get; set; } = [];
    public string? Cursor { get; set; }
}

public class NotificationDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public bool Read { get; set; }
    public string? ActionLabel { get; set; }
    public string? ActionPayload { get; set; }
}
