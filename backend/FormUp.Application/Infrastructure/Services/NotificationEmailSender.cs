using System.Net;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// Default <see cref="INotificationEmailSender"/>: checks the recipient's email switch, builds the portal link and
/// hands a values-only work item to the background queue. Every failure is logged with ids and swallowed.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="queue">Background email queue drained by <see cref="EmailDispatchWorker"/>.</param>
/// <param name="configuration">Application configuration; supplies the portal base URL.</param>
/// <param name="logger">Logger. Never receives an email address.</param>
public class NotificationEmailSender(
    IApplicationDbContext db,
    IBackgroundEmailQueue queue,
    IConfiguration configuration,
    ILogger<NotificationEmailSender> logger) : INotificationEmailSender
{
    /// <inheritdoc />
    public async Task SendAsync(
        Guid recipientUserId,
        NotificationEvent notificationEvent,
        IReadOnlyDictionary<string, string> values,
        CancellationToken ct)
    {
        try
        {
            await EnqueueAsync(recipientUserId, notificationEvent, values, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Failed to queue {Event} notification email for user {UserId}", notificationEvent, recipientUserId);
        }
    }

    private async Task EnqueueAsync(
        Guid recipientUserId,
        NotificationEvent notificationEvent,
        IReadOnlyDictionary<string, string> values,
        CancellationToken ct)
    {
        // The new-message email has no template yet.
        if (EmailTemplateRenderer.TemplateFor(notificationEvent) is null)
        {
            return;
        }

        var savedEmailEnabled = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == recipientUserId && p.Event == notificationEvent)
            .Select(p => (bool?)p.EmailEnabled)
            .FirstOrDefaultAsync(ct);

        if (!(savedEmailEnabled ?? NotificationPreferenceDefaults.For(notificationEvent).Email))
        {
            return;
        }

        var recipient = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == recipientUserId)
            .Select(u => new { u.Email, u.Language })
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrWhiteSpace(recipient?.Email))
        {
            return;
        }

        var itemValues = new Dictionary<string, string>(values)
        {
            [NotificationEmailWorkItem.ActionUrlKey] = BuildActionUrl(notificationEvent, values),
        };

        var item = new NotificationEmailWorkItem(
            recipient.Email,
            EmailTemplateRenderer.NormalizeLanguage(recipient.Language),
            recipientUserId,
            notificationEvent,
            itemValues);

        if (!queue.TryEnqueue(item))
        {
            logger.LogWarning(
                "Email queue full or closed; dropped {Event} notification email for user {UserId}",
                notificationEvent, recipientUserId);
        }
    }

    private string BuildActionUrl(NotificationEvent notificationEvent, IReadOnlyDictionary<string, string> values)
    {
        var baseUrl = (configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173").TrimEnd('/');

        if (notificationEvent == NotificationEvent.JoinRequest
            || !values.TryGetValue(NotificationEmailWorkItem.ClientPublicIdKey, out var clientPublicId))
        {
            return $"{baseUrl}/clients?tab=Pending";
        }

        var clientPath = $"{baseUrl}/clients/{WebUtility.UrlEncode(clientPublicId)}";

        return notificationEvent switch
        {
            NotificationEvent.WeeklyCheckInSubmitted => $"{clientPath}/forms",
            NotificationEvent.ProgressPhotosSubmitted => $"{clientPath}/photos",
            _ => clientPath,
        };
    }
}
