using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Users.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.GetNotificationPreferences;

/// <summary>
/// Returns the caller's email and push choice for every notification event.
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class GetNotificationPreferencesEndpoint(IApplicationDbContext db)
    : EndpointWithoutRequest<GetNotificationPreferencesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/users/me/notification-preferences");
        Summary(s =>
        {
            s.Summary = "Get notification preferences";
            s.Description = "Returns email and push choices for all events; events never saved return their defaults.";
            s.Responses[StatusCodes.Status200OK] = "Preferences for all notification events";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var saved = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.Event, ct);

        var preferences = NotificationPreferenceDefaults.AllEvents
            .Select(notificationEvent =>
            {
                if (saved.TryGetValue(notificationEvent, out var row))
                {
                    return new NotificationPreferenceDto
                    {
                        Event = notificationEvent,
                        Email = row.EmailEnabled,
                        Push = row.PushEnabled,
                    };
                }

                var (email, push) = NotificationPreferenceDefaults.For(notificationEvent);
                return new NotificationPreferenceDto { Event = notificationEvent, Email = email, Push = push };
            })
            .ToList();

        await Send.OkAsync(new GetNotificationPreferencesResponse { Preferences = preferences }, ct);
    }
}
