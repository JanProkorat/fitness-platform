using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// Pre-link inbox rows: conversations with a client who has no link of any kind to the caller
/// yet (a pending request or invite) and is not flagged former.
/// </summary>
public static class PreLinkConversations
{
    /// <summary>
    /// Pre-link conversations of the professional that hold an unread client text message
    /// (event rows never count). One query, no per-row lookups.
    /// </summary>
    public static IQueryable<Conversation> WithUnreadMessages(IApplicationDbContext db, Guid professionalUserId) =>
        db.Conversations
            .Where(c => c.ProfessionalUserId == professionalUserId
                        && !c.IsFormer
                        && !db.ClientProfessionalLinks.Any(l =>
                            l.ClientProfile.UserId == c.ClientUserId
                            && l.ProfessionalProfile.UserId == professionalUserId)
                        && c.Messages.Any(m =>
                            !m.IsRead && m.SenderUserId == c.ClientUserId && m.Kind != ChatMessageKind.Event));
}
