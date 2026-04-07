using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetConversationContext;

/// <summary>
/// Returns contextual banner data for a conversation (e.g. a pending invite).
/// </summary>
public class GetConversationContextEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    : Endpoint<GetConversationContextRequest, ConversationContextResponse>
{
    public override void Configure()
    {
        Get("/conversations/{ConversationId}/context");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get conversation context";
            s.Description = "Returns contextual banner data for a conversation, such as a pending invite.";
        });
    }

    public override async Task HandleAsync(GetConversationContextRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);

        // Find conversation and verify participation
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

        // Look up professional profile with user navigation
        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == conversation.ProfessionalUserId, ct);

        if (professionalProfile is null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        // Get client email
        var clientEmail = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == conversation.ClientUserId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(ct);

        if (clientEmail is null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        // Check for pending invite
        var pendingInvite = await db.PendingInvites
            .AsNoTracking()
            .FirstOrDefaultAsync(i =>
                i.ProfessionalProfileId == professionalProfile.Id &&
                i.Email == clientEmail &&
                !i.IsAccepted, ct);

        if (pendingInvite is null)
        {
            await Send.NoContentAsync(ct);
            return;
        }

        // Resolve professional role
        var roles = await userManager.GetRolesAsync(professionalProfile.User);
        var trainerRole = roles.FirstOrDefault(r => r is AppRoles.Trainer or AppRoles.Nutritionist) ?? "Trainer";

        var trainerName = $"{professionalProfile.User.FirstName} {professionalProfile.User.LastName}".Trim();
        var trainerCity = professionalProfile.City ?? "";

        var sub = !string.IsNullOrEmpty(trainerCity)
            ? $"{trainerRole} · {trainerCity}"
            : trainerRole;

        await Send.OkAsync(new ConversationContextResponse
        {
            Type = "invite",
            InviteId = pendingInvite.PublicId,
            Icon = "person-add",
            Title = $"{trainerName} invited you to collaborate",
            Sub = sub,
            ActionLabel = "Accept",
            ActionRoute = "",
        }, ct);
    }
}

public class GetConversationContextRequest
{
    public Guid ConversationId { get; set; }
}

public class ConversationContextResponse
{
    public string Type { get; set; } = string.Empty;
    public Guid? InviteId { get; set; }
    public string Icon { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Sub { get; set; } = string.Empty;
    public string ActionLabel { get; set; } = string.Empty;
    public string ActionRoute { get; set; } = string.Empty;
}
