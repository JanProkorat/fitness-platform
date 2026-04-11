using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.MarkRead;

/// <summary>
/// Marks all messages in a conversation as read for the authenticated user.
/// </summary>
public class MarkConversationReadEndpoint(IApplicationDbContext db) : Endpoint<MarkReadRequest>
{
    public override void Configure()
    {
        Post("/conversations/{ConversationId}/read");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Mark conversation as read";
            s.Description = "Marks all unread messages from the other participant as read.";
        });
    }

    public override async Task HandleAsync(MarkReadRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var conversation = await db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.PublicId == req.ConversationId &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid), ct);

        if (conversation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Mark messages from the OTHER user as read
        await db.ChatMessages
            .Where(m => m.ConversationId == conversation.Id
                     && m.SenderUserId != userGuid
                     && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true), ct);

        await Send.NoContentAsync(ct);
    }
}

public class MarkReadRequest
{
    public Guid ConversationId { get; set; }
}
