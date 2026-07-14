using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <inheritdoc cref="IConversationSeedService"/>
public class ConversationSeedService(IApplicationDbContext db, IRealtimeNotifier notifier)
    : IConversationSeedService
{
    /// <inheritdoc />
    public async Task<Conversation> GetOrSeedConversationAsync(
        Guid professionalUserId,
        Guid clientUserId,
        Guid senderUserId,
        string senderName,
        string? messageText,
        bool seedIntoExisting,
        CancellationToken ct)
    {
        var conversation = await db.Conversations
            .FirstOrDefaultAsync(c =>
                c.ProfessionalUserId == professionalUserId &&
                c.ClientUserId == clientUserId, ct);

        var isNewConversation = conversation is null;

        if (conversation is null)
        {
            conversation = new Conversation
            {
                ProfessionalUserId = professionalUserId,
                ClientUserId = clientUserId,
            };
            db.Conversations.Add(conversation);
        }

        // FIX 3 (#768 review): invite-creation callers (seedIntoExisting: true) must
        // still deliver the message into an already-existing conversation — matches
        // the pre-extraction inline behavior. Invite-accept callers (seedIntoExisting:
        // false) only ever seed a brand-new conversation, so re-accepting/re-processing
        // the same invite can't duplicate a message that was already delivered (either
        // at invite-creation time, or by an earlier accept).
        var shouldSeedMessage = !string.IsNullOrWhiteSpace(messageText) && (isNewConversation || seedIntoExisting);

        ChatMessage? message = null;

        if (shouldSeedMessage)
        {
            var text = messageText!.Trim();

            // FIX 1 (#768 review): build the message via the Conversation navigation
            // property — NOT a post-save ConversationId assignment — so the new
            // conversation and its first message are inserted in a SINGLE
            // SaveChangesAsync below. The previous two-save form could persist a
            // conversation shell with no message if the second save failed, and
            // because the next attempt would then see isNewConversation == false,
            // the message would be permanently lost.
            message = new ChatMessage
            {
                Conversation = conversation,
                SenderUserId = senderUserId,
                Text = text,
                IsRead = false,
            };
            db.ChatMessages.Add(message);

            conversation.LastMessageText = text.Length > 300 ? text[..300] : text;
            conversation.LastMessageAt = DateTime.UtcNow;
            conversation.LastMessageSenderId = senderUserId;
        }

        if (isNewConversation || shouldSeedMessage)
        {
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (isNewConversation && IsUniqueViolation(ex))
            {
                // FIX 2 (#768 review): a concurrent request (double-tap accept, client
                // retry) won the race and already inserted the (ProfessionalUserId,
                // ClientUserId) conversation first. Detach our losing Added entities
                // (Remove() on an entity still in the Added state just untracks it —
                // no DELETE is issued) and re-query the winner's row. Treat this as
                // the "already existed" no-op branch: no seed, no duplicate, no 500.
                if (message is not null) db.ChatMessages.Remove(message);
                db.Conversations.Remove(conversation);

                conversation = await db.Conversations
                    .FirstAsync(c =>
                        c.ProfessionalUserId == professionalUserId &&
                        c.ClientUserId == clientUserId, ct);

                return conversation;
            }
        }

        if (shouldSeedMessage)
        {
            var recipientUserId = senderUserId == professionalUserId ? clientUserId : professionalUserId;

            await notifier.NotifyAsync(recipientUserId, "newmessage", new
            {
                conversationId = conversation.PublicId,
                messageId = message!.PublicId,
                senderId = senderUserId,
                senderName,
                text = message.Text,
                timestamp = message.DateCreated,
            }, ct);
        }

        return conversation;
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505";
}
