using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Users.UpdateNotificationPreferences;

/// <summary>
/// Saves the caller's email and push choice for every notification event.
/// </summary>
/// <param name="db">Application database context.</param>
internal sealed class UpdateNotificationPreferencesEndpoint(IApplicationDbContext db)
    : Endpoint<UpdateNotificationPreferencesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/users/me/notification-preferences");
        Summary(s =>
        {
            s.Summary = "Update notification preferences";
            s.Description = "Replaces the caller's email and push choices; the body must contain all five events.";
            s.Responses[StatusCodes.Status204NoContent] = "Preferences saved";
            s.Responses[StatusCodes.Status400BadRequest] = "Missing, duplicate or unknown event";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateNotificationPreferencesRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var existing = await db.NotificationPreferences
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.Event, ct);

        foreach (var item in req.Preferences)
        {
            if (existing.TryGetValue(item.Event, out var row))
            {
                row.EmailEnabled = item.Email;
                row.PushEnabled = item.Push;
                continue;
            }

            db.NotificationPreferences.Add(new NotificationPreference
            {
                UserId = userId,
                Event = item.Event,
                EmailEnabled = item.Email,
                PushEnabled = item.Push,
            });
        }

        await db.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
