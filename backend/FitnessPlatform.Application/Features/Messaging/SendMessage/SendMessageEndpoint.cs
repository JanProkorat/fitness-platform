using System.Security.Claims;
using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.SendMessage;

/// <summary>
/// Sends a message in a conversation. Creates the conversation if it doesn't exist yet.
/// </summary>
public class SendMessageEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier) : Endpoint<SendMessageRequest, SendMessageResponse>
{
    public override void Configure()
    {
        Post("/conversations/{ConversationId}/messages");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Send a message";
            s.Description = "Sends a text message in a conversation.";
        });
    }

    public override async Task HandleAsync(SendMessageRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        // Verify user is a participant
        var conversation = await db.Conversations
            .FirstOrDefaultAsync(c =>
                c.PublicId == req.ConversationId &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid), ct);

        if (conversation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var message = new ChatMessage
        {
            ConversationId = conversation.Id,
            SenderUserId = userGuid,
            Text = req.Text.Trim(),
            IsRead = false,
        };

        db.ChatMessages.Add(message);

        // Update conversation preview
        conversation.LastMessageText = message.Text.Length > 300
            ? message.Text[..300]
            : message.Text;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.LastMessageSenderId = userGuid;

        await db.SaveChangesAsync(ct);

        // Get sender name for notification
        var sender = await db.Users.AsNoTracking()
            .Where(u => u.Id == userGuid)
            .Select(u => new { u.FirstName, u.LastName })
            .FirstAsync(ct);

        var senderName = $"{sender.FirstName} {sender.LastName}";

        // Determine recipient
        var recipientUserId = conversation.ProfessionalUserId == userGuid
            ? conversation.ClientUserId
            : conversation.ProfessionalUserId;

        // Auto-unarchive for recipient (unless former collaboration)
        bool autoUnarchived = false;
        if (!conversation.IsFormer)
        {
            if (conversation.ProfessionalUserId == userGuid && conversation.ArchivedByClientAt != null)
            {
                conversation.ArchivedByClientAt = null;
                autoUnarchived = true;
            }
            else if (conversation.ClientUserId == userGuid && conversation.ArchivedByProfessionalAt != null)
            {
                conversation.ArchivedByProfessionalAt = null;
                autoUnarchived = true;
            }

            if (autoUnarchived)
            {
                await db.SaveChangesAsync(ct);
                await notifier.NotifyAsync(recipientUserId, "conversationunarchived", new
                {
                    conversationId = conversation.PublicId,
                    isFormer = false,
                }, ct);
            }
        }

        // Notify recipient via SignalR
        await notifier.NotifyAsync(recipientUserId, "newmessage", new
        {
            conversationId = conversation.PublicId,
            messageId = message.PublicId,
            senderId = userGuid,
            senderName,
            text = message.Text,
            timestamp = message.DateCreated,
        }, ct);

        await Send.OkAsync(new SendMessageResponse
        {
            Id = message.PublicId,
            SenderId = message.SenderUserId,
            Text = message.Text,
            Timestamp = message.DateCreated,
            IsRead = message.IsRead,
        }, ct);
    }
}

public class SendMessageRequest
{
    public Guid ConversationId { get; set; }
    public string Text { get; set; } = string.Empty;
}

public class SendMessageValidator : FastEndpoints.Validator<SendMessageRequest>
{
    public SendMessageValidator()
    {
        RuleFor(x => x.Text)
            .NotEmpty().WithMessage("Message text is required.")
            .MaximumLength(4000).WithMessage("Message must be at most 4000 characters.");
    }
}

public class SendMessageResponse
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool IsRead { get; set; }
}
