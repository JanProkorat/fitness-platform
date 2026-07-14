using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

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
            await db.SaveChangesAsync(ct);
        }

        // Only ever seed the first message into a brand-new conversation. If the
        // conversation already existed, the message was either already delivered by
        // a prior call (e.g. CreatePendingInviteEndpoint seeded it at invite-creation
        // time for an invitee who already had an account, and the invitee is now
        // separately accepting the same invite) or the two participants were already
        // chatting — either way, re-adding it here would duplicate the message.
        if (isNewConversation && !string.IsNullOrWhiteSpace(messageText))
        {
            var text = messageText.Trim();

            var message = new ChatMessage
            {
                ConversationId = conversation.Id,
                SenderUserId = senderUserId,
                Text = text,
                IsRead = false,
            };
            db.ChatMessages.Add(message);

            conversation.LastMessageText = text.Length > 300 ? text[..300] : text;
            conversation.LastMessageAt = DateTime.UtcNow;
            conversation.LastMessageSenderId = senderUserId;

            await db.SaveChangesAsync(ct);

            var recipientUserId = senderUserId == professionalUserId ? clientUserId : professionalUserId;

            await notifier.NotifyAsync(recipientUserId, "newmessage", new
            {
                conversationId = conversation.PublicId,
                messageId = message.PublicId,
                senderId = senderUserId,
                senderName,
                text = message.Text,
                timestamp = message.DateCreated,
            }, ct);
        }

        return conversation;
    }
}
