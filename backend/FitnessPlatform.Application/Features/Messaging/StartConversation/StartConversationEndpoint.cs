using System.Security.Claims;
using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Messaging.GetConversations;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.StartConversation;

/// <summary>
/// Gets or creates a conversation between the professional and a client.
/// Accepts a participant profile PublicId (ClientProfile or ProfessionalProfile)
/// and resolves it to the correct user.
/// </summary>
public class StartConversationEndpoint(IApplicationDbContext db) : Endpoint<StartConversationRequest, ConversationDto>
{
    public override void Configure()
    {
        Post("/conversations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Start or get a conversation";
            s.Description = "Gets an existing conversation with the specified participant. Creates one if it doesn't exist. Pass the participant's profile PublicId.";
        });
    }

    public override async Task HandleAsync(StartConversationRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        // Determine caller role: prefer professional role (Trainer/Nutritionist) over Client
        var isProfessional = User.IsInRole(AppRoles.Trainer) || User.IsInRole(AppRoles.Nutritionist);

        Guid professionalUserId;
        Guid clientUserId;
        ApplicationUser otherUser;
        // For professionals the avatar falls back from profile-level to user-level;
        // for clients only the user-level avatar exists (ClientProfile has no AvatarBlobUrl).
        string? participantAvatarBlobUrl;

        if (isProfessional)
        {
            // Professional is starting conversation — participantId is a ClientProfile.PublicId
            var client = await db.ClientProfiles
                .AsNoTracking()
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.PublicId == req.ParticipantId, ct);

            if (client is null) { await Send.NotFoundAsync(ct); return; }

            professionalUserId = userGuid;
            clientUserId = client.UserId;
            otherUser = client.User;
            // ClientProfile has no dedicated AvatarBlobUrl; use the user-level avatar.
            participantAvatarBlobUrl = client.User.AvatarBlobUrl;
        }
        else
        {
            // Client is starting conversation — participantId is a ProfessionalProfile.PublicId
            var prof = await db.ProfessionalProfiles
                .AsNoTracking()
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.PublicId == req.ParticipantId, ct);

            if (prof is null) { await Send.NotFoundAsync(ct); return; }

            professionalUserId = prof.UserId;
            clientUserId = userGuid;
            otherUser = prof.User;
            // Prefer the professional-profile avatar; fall back to the user-level avatar.
            participantAvatarBlobUrl = prof.AvatarBlobUrl ?? prof.User.AvatarBlobUrl;
        }

        // Check if conversation already exists
        var existing = await db.Conversations
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c =>
                c.ProfessionalUserId == professionalUserId && c.ClientUserId == clientUserId, ct);

        if (existing is not null)
        {
            await Send.OkAsync(new ConversationDto
            {
                Id = existing.PublicId,
                Participant = new ParticipantDto
                {
                    Id = otherUser.Id,
                    Name = otherUser.FirstName + " " + otherUser.LastName,
                    Initials = ComputeInitials(otherUser.FirstName, otherUser.LastName, otherUser.Email),
                    Online = false,
                    AvatarBlobUrl = participantAvatarBlobUrl,
                },
                LastMessage = existing.LastMessageText ?? "",
                LastMessageAt = existing.LastMessageAt ?? existing.DateCreated,
                LastMessageIsOwn = existing.LastMessageSenderId == userGuid,
                UnreadCount = existing.Messages.Count(m => !m.IsRead && m.SenderUserId != userGuid),
            }, ct);
            return;
        }

        var conversation = new Conversation
        {
            ProfessionalUserId = professionalUserId,
            ClientUserId = clientUserId,
        };

        db.Conversations.Add(conversation);
        await db.SaveChangesAsync(ct);

        await Send.OkAsync(new ConversationDto
        {
            Id = conversation.PublicId,
            Participant = new ParticipantDto
            {
                Id = otherUser.Id,
                Name = otherUser.FirstName + " " + otherUser.LastName,
                Initials = ComputeInitials(otherUser.FirstName, otherUser.LastName, otherUser.Email),
                Online = false,
                AvatarBlobUrl = participantAvatarBlobUrl,
            },
            LastMessage = "",
            LastMessageAt = conversation.DateCreated,
            LastMessageIsOwn = false,
            UnreadCount = 0,
        }, ct);
    }

    /// <summary>
    /// Computes a two-letter initials fallback for a participant's avatar badge.
    /// Handles Apple Sign-In users who declined to share their name (FirstName
    /// and/or LastName persisted as ""), where naively slicing the first
    /// character would throw <see cref="ArgumentOutOfRangeException"/>.
    /// Falls back to the email's first character, then a generic glyph, when
    /// both names are empty.
    /// </summary>
    private static string ComputeInitials(string firstName, string lastName, string? email)
    {
        var firstInitial = string.IsNullOrEmpty(firstName) ? "" : firstName[..1];
        var lastInitial = string.IsNullOrEmpty(lastName) ? "" : lastName[..1];
        var initials = (firstInitial + lastInitial).ToUpper();

        if (!string.IsNullOrEmpty(initials))
            return initials;

        if (!string.IsNullOrEmpty(email))
            return email[..1].ToUpper();

        return "?";
    }
}

public class StartConversationRequest
{
    /// <summary>
    /// The PublicId of the participant's profile (ClientProfile.PublicId or ProfessionalProfile.PublicId).
    /// </summary>
    public Guid ParticipantId { get; set; }
}

public class StartConversationValidator : FastEndpoints.Validator<StartConversationRequest>
{
    public StartConversationValidator()
    {
        RuleFor(x => x.ParticipantId).NotEmpty();
    }
}
