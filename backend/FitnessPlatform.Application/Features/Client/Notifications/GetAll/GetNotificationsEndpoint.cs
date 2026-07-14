using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
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

        // The caller's own stored language localizes the (currently English-only)
        // ActionLabel below. Title/Body are already localized at write time by
        // NotificationService — see #788.
        var language = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == userGuid)
            .Select(u => u.Language)
            .FirstOrDefaultAsync(ct);

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

        // Materialize entities first, then project to DTOs in-memory — GetActionLabel's
        // localization lookup isn't SQL-translatable.
        var notifications = await query.Take(limit).ToListAsync(ct);

        var items = notifications
            .Select(n => new NotificationDto
            {
                Id = n.PublicId.ToString(),
                Type = n.Type.ToString().ToLowerInvariant(),
                Title = n.Title,
                Body = n.Body,
                Timestamp = n.DateCreated.ToString("O"),
                Read = n.IsRead,
                ActionLabel = GetActionLabel(n.Type, language),
                ActionPayload = n.Data
            })
            .ToList();

        string? nextCursor = null;
        if (items.Count == limit)
            nextCursor = items[^1].Id;

        await Send.OkAsync(new GetNotificationsResponse { Items = items, Cursor = nextCursor }, ct);
    }

    private static readonly Dictionary<string, (string InvitationReceived, string QuestionnaireAssigned, string PlanPublished)> ActionLabels = new()
    {
        ["en"] = ("View invitation", "Open questionnaire", "View plan"),
        ["cs"] = ("Zobrazit pozvánku", "Otevřít dotazník", "Zobrazit plán"),
        ["de"] = ("Einladung ansehen", "Fragebogen öffnen", "Plan ansehen"),
    };

    private static string? GetActionLabel(Domain.Enums.NotificationType type, string? language)
    {
        var labels = ActionLabels.TryGetValue(language?.ToLowerInvariant() ?? "en", out var found)
            ? found
            : ActionLabels["en"];

        return type switch
        {
            Domain.Enums.NotificationType.InvitationReceived => labels.InvitationReceived,
            Domain.Enums.NotificationType.QuestionnaireAssigned => labels.QuestionnaireAssigned,
            Domain.Enums.NotificationType.PlanPublished => labels.PlanPublished,
            _ => null
        };
    }
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
