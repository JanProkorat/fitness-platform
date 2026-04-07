using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetConversations;

/// <summary>
/// Returns conversations for the authenticated user (professional or client).
/// </summary>
public class GetConversationsEndpoint(IApplicationDbContext db, PresenceTracker presence) : Endpoint<GetConversationsRequest, List<ConversationDto>>
{
    public override void Configure()
    {
        Get("/conversations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get conversations";
            s.Description = "Returns all conversations for the authenticated user.";
        });
    }

    public override async Task HandleAsync(GetConversationsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var isProfessional = User.IsInRole(AppRoles.Trainer) || User.IsInRole(AppRoles.Nutritionist);

        var conversations = await db.Conversations
            .AsNoTracking()
            .Where(c => isProfessional ? c.ProfessionalUserId == userGuid : c.ClientUserId == userGuid)
            .Where(c => isProfessional
                ? (req.Archived ? c.ArchivedByProfessionalAt != null : c.ArchivedByProfessionalAt == null)
                : (req.Archived ? c.ArchivedByClientAt != null : c.ArchivedByClientAt == null))
            .OrderByDescending(c => c.LastMessageAt ?? c.DateCreated)
            .Select(c => new ConversationDto
            {
                Id = c.PublicId,
                Participant = isProfessional
                    ? new ParticipantDto
                    {
                        Id = c.Client.Id,
                        Name = c.Client.FirstName + " " + c.Client.LastName,
                        Initials = (c.Client.FirstName.Substring(0, 1) + c.Client.LastName.Substring(0, 1)).ToUpper(),
                        Online = false, // populated below
                    }
                    : new ParticipantDto
                    {
                        Id = c.Professional.Id,
                        Name = c.Professional.FirstName + " " + c.Professional.LastName,
                        Initials = (c.Professional.FirstName.Substring(0, 1) + c.Professional.LastName.Substring(0, 1)).ToUpper(),
                        Online = false, // populated below
                    },
                LastMessage = c.LastMessageText ?? "",
                LastMessageAt = c.LastMessageAt ?? c.DateCreated,
                LastMessageIsOwn = c.LastMessageSenderId == userGuid,
                UnreadCount = c.Messages.Count(m => !m.IsRead && m.SenderUserId != userGuid),
                IsFormer = c.IsFormer,
            })
            .ToListAsync(ct);

        // Set real online status from presence tracker
        foreach (var c in conversations)
            c.Participant.Online = presence.IsOnline(c.Participant.Id);

        await Send.OkAsync(conversations, ct);
    }
}

public class GetConversationsRequest
{
    [QueryParam]
    public bool Archived { get; set; } = false;
}

public class ConversationDto
{
    public Guid Id { get; set; }
    public ParticipantDto Participant { get; set; } = null!;
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastMessageAt { get; set; }
    public bool LastMessageIsOwn { get; set; }
    public int UnreadCount { get; set; }
    public bool IsFormer { get; set; }
}

public class ParticipantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Initials { get; set; } = string.Empty;
    public bool Online { get; set; }
}
