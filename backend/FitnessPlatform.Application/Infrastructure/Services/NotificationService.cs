using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Creates notifications in PostgreSQL and sends push notifications to mobile devices.
/// </summary>
public class NotificationService(IApplicationDbContext db, IPushNotificationService push) : INotificationService
{
    /// <inheritdoc />
    public async Task CreateAsync(Guid recipientUserId, NotificationType type, string title, string body, string? data = null, CancellationToken ct = default)
    {
        var notification = new Notification
        {
            RecipientUserId = recipientUserId,
            Type = type,
            Title = title,
            Body = body,
            Data = data
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        // Send push notification to the user's mobile devices
        await push.SendAsync(recipientUserId, title, body, data != null
            ? new { type = type.ToString(), payload = data }
            : new { type = type.ToString() } as object, ct);
    }
}
