using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.ArchiveConversation;

/// <summary>
/// Archives a conversation for the authenticated user.
/// Each participant can independently archive a conversation.
/// </summary>
public class ArchiveConversationEndpoint(IApplicationDbContext db) : Endpoint<ArchiveConversationRequest>
{
    public override void Configure()
    {
        Patch("/conversations/{ConversationId}/archive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Archive conversation";
            s.Description = "Archives a conversation for the authenticated user. The other participant is not affected.";
        });
    }

    public override async Task HandleAsync(ArchiveConversationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        var conversation = await db.Conversations
            .FirstOrDefaultAsync(c =>
                c.PublicId == req.ConversationId &&
                (c.ProfessionalUserId == userGuid || c.ClientUserId == userGuid), ct);

        if (conversation is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (conversation.ProfessionalUserId == userGuid)
            conversation.ArchivedByProfessionalAt = DateTime.UtcNow;
        else
            conversation.ArchivedByClientAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class ArchiveConversationRequest
{
    public Guid ConversationId { get; set; }
}
