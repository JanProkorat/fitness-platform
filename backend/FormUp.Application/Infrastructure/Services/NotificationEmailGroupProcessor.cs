using System.Globalization;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FormUp.Application.Infrastructure.Services;

/// <summary>
/// Claims one due <see cref="PendingNotificationEmail"/> burst, works out what it stands for and sends the one
/// grouped email. The row is deleted and the transaction committed before anything is queued, so delivery is at
/// most once: a crash after the commit loses the email rather than sending it twice. The email carries only the
/// sender's name and how many messages are unread, never message text, and nothing is loaded from message bodies.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="sender">Sends the email; it checks the recipient's email switch.</param>
/// <param name="logger">Logger. Receives ids only.</param>
public sealed class NotificationEmailGroupProcessor(
    IApplicationDbContext db,
    INotificationEmailSender sender,
    ILogger<NotificationEmailGroupProcessor> logger)
{
    private sealed record PendingSend(Guid RecipientUserId, NotificationEvent Event, Dictionary<string, string> Values);

    /// <summary>
    /// Claims and handles the earliest due burst. Call it in a fresh scope per burst.
    /// </summary>
    /// <param name="nowUtc">The current instant.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True when a burst was claimed (sent, skipped or discarded); false when nothing was due.</returns>
    public async Task<bool> ProcessNextAsync(DateTime nowUtc, CancellationToken ct)
    {
        PendingSend? send;
        long pendingId;

        await using (var transaction = await db.BeginTransactionAsync(ct))
        {
            var pending = await db.ClaimDuePendingNotificationEmailAsync(nowUtc, ct);

            if (pending is null)
            {
                return false;
            }

            pendingId = pending.Id;

            try
            {
                send = await BuildAsync(pending, ct);
                db.PendingNotificationEmails.Remove(pending);
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "NotificationEmailGroupingScheduler: handling pending email {PendingId} failed.", pendingId);
                await DiscardAsync(pendingId, ct);

                return true;
            }
        }

        if (send is not null)
        {
            await sender.SendAsync(send.RecipientUserId, send.Event, send.Values, ct);
        }

        return true;
    }

    /// <summary>
    /// Builds what to send, or null when there is nothing to send: the conversation is gone or no longer the
    /// recipient's, or the recipient has read every message of the burst.
    /// </summary>
    private async Task<PendingSend?> BuildAsync(PendingNotificationEmail pending, CancellationToken ct)
    {
        // New messages are the only grouped event for now; another event adds its own branch here.
        if (pending.Event != NotificationEvent.NewMessage)
        {
            return null;
        }

        var conversation = await db.Conversations
            .AsNoTracking()
            .Where(c => c.PublicId == pending.GroupId && c.ProfessionalUserId == pending.RecipientUserId)
            .Select(c => new { c.Id, c.ClientUserId })
            .FirstOrDefaultAsync(ct);

        if (conversation is null)
        {
            return null;
        }

        // Only the number is read, never the text. The window is the burst itself: from its first to its last message.
        var unreadCount = await db.ChatMessages
            .AsNoTracking()
            .CountAsync(m => m.ConversationId == conversation.Id
                             && m.SenderUserId == conversation.ClientUserId
                             && m.Kind == ChatMessageKind.Text
                             && !m.IsRead
                             && m.DateCreated >= pending.FirstEventAt
                             && m.DateCreated <= pending.LastEventAt, ct);

        if (unreadCount == 0)
        {
            return null;
        }

        var client = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == conversation.ClientUserId)
            .Select(u => new { u.FirstName, u.LastName })
            .FirstOrDefaultAsync(ct);

        if (client is null)
        {
            return null;
        }

        var clientProfilePublicId = await db.ClientProfiles
            .AsNoTracking()
            .Where(cp => cp.UserId == conversation.ClientUserId)
            .Select(cp => (Guid?)cp.PublicId)
            .FirstOrDefaultAsync(ct);

        var values = new Dictionary<string, string>
        {
            [NotificationEmailWorkItem.ClientNameKey] = $"{client.FirstName} {client.LastName}".Trim(),
            [NotificationEmailWorkItem.MessageCountKey] = unreadCount.ToString(CultureInfo.InvariantCulture),
        };

        if (clientProfilePublicId is { } publicId)
        {
            values[NotificationEmailWorkItem.ClientPublicIdKey] = publicId.ToString();
        }

        return new PendingSend(pending.RecipientUserId, pending.Event, values);
    }

    // A row that cannot be handled is dropped so it cannot starve the ones behind it.
    private async Task DiscardAsync(long pendingId, CancellationToken ct)
    {
        try
        {
            await db.PendingNotificationEmails.Where(p => p.Id == pendingId).ExecuteDeleteAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "NotificationEmailGroupingScheduler: could not discard pending email {PendingId}.", pendingId);
        }
    }
}
