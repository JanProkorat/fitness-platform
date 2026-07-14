using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Creates notifications in PostgreSQL and sends push notifications to mobile devices.
/// Resolves title/body from <see cref="NotificationTemplates"/> using the recipient's
/// stored language (falls back to English) so notifications are localized regardless of
/// which user/process triggered the notification (#788).
/// </summary>
public class NotificationService(IApplicationDbContext db, IPushNotificationService push) : INotificationService
{
    /// <inheritdoc />
    public async Task<Notification> CreateAsync(
        Guid recipientUserId,
        NotificationType type,
        IReadOnlyDictionary<string, string>? parameters = null,
        string? variant = null,
        CancellationToken ct = default)
    {
        var recipientLanguage = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == recipientUserId)
            .Select(u => u.Language)
            .FirstOrDefaultAsync(ct);

        var (title, body) = NotificationTemplates.Resolve(type, recipientLanguage, parameters, variant);

        var notification = new Notification
        {
            RecipientUserId = recipientUserId,
            Type = type,
            Title = title,
            Body = body,
            Data = parameters is { Count: > 0 } ? JsonSerializer.Serialize(parameters) : null
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);

        // Send push notification to the user's mobile devices. Uses the SAME resolved
        // title/body as the in-app notification — the OS push banner renders before the
        // app opens, so it must already be in the recipient's language at send time.
        await push.SendAsync(recipientUserId, title, body, new { type = type.ToString() }, ct);

        return notification;
    }
}
