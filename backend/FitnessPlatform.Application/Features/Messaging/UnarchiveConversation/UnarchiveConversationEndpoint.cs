using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.UnarchiveConversation;

/// <summary>
/// Unarchives a conversation for the authenticated user.
/// Each participant can independently unarchive a conversation.
/// </summary>
public class UnarchiveConversationEndpoint(IApplicationDbContext db) : Endpoint<UnarchiveConversationRequest>
{
    public override void Configure()
    {
        Patch("/conversations/{ConversationId}/unarchive");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Unarchive conversation";
            s.Description = "Unarchives a conversation for the authenticated user. The other participant is not affected.";
        });
    }

    public override async Task HandleAsync(UnarchiveConversationRequest req, CancellationToken ct)
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
            conversation.ArchivedByProfessionalAt = null;
        else
            conversation.ArchivedByClientAt = null;

        await db.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}

public class UnarchiveConversationRequest
{
    public Guid ConversationId { get; set; }
}
