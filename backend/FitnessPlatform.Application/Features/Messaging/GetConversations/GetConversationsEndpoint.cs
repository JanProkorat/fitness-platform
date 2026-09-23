using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Messaging.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.GetConversations;

/// <summary>
/// Returns conversations for the authenticated user (professional or client).
/// </summary>
/// <remarks>
/// A Client caller always gets today's plain, link-state-agnostic conversation query (including
/// any <c>IsFormer</c> row) and may never request a chip other than
/// <see cref="ClientListFilter.All"/>.
/// <para/>
/// A professional caller always goes through the live-roster path
/// (<see cref="ConversationRosterLoader"/>, live links only): every linked client is classified
/// against <see cref="GetConversationsRequest.Filter"/> — the same six-way chip set
/// <c>GetClientsEndpoint</c> exposes — whether or not a conversation exists yet, and a client with
/// no conversation whose facts still match the chip is returned as a placeholder row with
/// <see cref="ConversationDto.Id"/> null. <c>archived</c> is applied after the chip — a
/// placeholder row (no conversation, so nothing to archive) survives only when
/// <c>archived=false</c>.
/// <para/>
/// <see cref="ClientListFilter.All"/> (or an omitted filter) additionally unions in every
/// conversation whose client is NOT on the live roster (a deactivated/former link, including any
/// <c>IsFormer</c> row) — the population the plain query always returned — so a professional's
/// All view never loses a conversation just because the underlying link ended. Every other chip
/// stays roster-only: a former client's conversation, however unread, does not surface under
/// UnreadMessages once its link is deactivated.
/// </remarks>
/// <param name="db">Database context.</param>
/// <param name="mongo">MongoDB context — plan-window lookups for the EndingSoon chip.</param>
/// <param name="presence">Resolves each participant's live online status.</param>
/// <param name="timeProvider">Clock abstraction — lets tests pin "now" deterministically.</param>
public class GetConversationsEndpoint(
    IApplicationDbContext db,
    IMongoContext mongo,
    PresenceTracker presence,
    TimeProvider timeProvider) : Endpoint<GetConversationsRequest, List<ConversationDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/conversations");
        Roles(AppRoles.Trainer, AppRoles.Nutritionist, AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get conversations";
            s.Description = "Returns all conversations for the authenticated user, optionally " +
                             "narrowed by a clients-list-style filter chip (professional callers only).";
            s.Responses[StatusCodes.Status200OK] = "Conversation list, newest activity first.";
            s.Responses[StatusCodes.Status400BadRequest] = "filter is not a member of ClientListFilter, " +
                                                             "or a non-All filter was requested by a Client caller.";
            s.Responses[StatusCodes.Status401Unauthorized] = "No caller claim on the request.";
            s.Responses[StatusCodes.Status404NotFound] = "Caller is a professional with no ProfessionalProfile.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetConversationsRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null) { await Send.UnauthorizedAsync(ct); return; }

        var userGuid = Guid.Parse(userId);
        var isProfessional = User.IsInRole(AppRoles.Trainer) || User.IsInRole(AppRoles.Nutritionist);

        if (!isProfessional)
        {
            if (req.Filter is not null && req.Filter != ClientListFilter.All)
            {
                this.ThrowErrorWithCode(
                    ErrorCodes.FilterRequiresProfessionalCaller,
                    "Filter chips are only available to a professional caller.");
                return;
            }

            await Send.OkAsync(await LoadPlainConversationsAsync(isProfessional: false, userGuid, req.Archived, ct), ct);
            return;
        }

        var professionalProfile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(pp => pp.UserId == userGuid, ct);

        if (professionalProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var roster = await ConversationRosterLoader.LoadAsync(db, mongo, professionalProfile.Id, userGuid, now, ct);

        var matched = roster.Where(r => ClientRosterFilterClassifier.Matches(
            req.Filter,
            r.UnreadMessageCount > 0,
            r.ConversationMessageCount == 0,
            r.HasNewCheckIn,
            r.HasMissingCheckIn,
            r.IsEndingSoon));

        var displayed = matched
            .Where(r => req.Archived
                ? r.ConversationPublicId is not null && r.IsArchivedByProfessional
                : r.ConversationPublicId is null || !r.IsArchivedByProfessional)
            .Select(r => BuildFromRosterRow(r, userGuid))
            .ToList();

        if (req.Filter is null || req.Filter == ClientListFilter.All)
        {
            var rosterClientIds = roster.Select(r => r.ClientUserId).ToHashSet();
            var offRosterConversations = await LoadPlainConversationsAsync(
                isProfessional: true, userGuid, req.Archived, ct, excludedClientUserIds: rosterClientIds);
            displayed.AddRange(offRosterConversations);
        }

        displayed = displayed.OrderByDescending(c => c.LastMessageAt).ToList();

        SetPresence(displayed);
        await Send.OkAsync(displayed, ct);
    }

    /// <summary>
    /// Today's pre-existing query — unchanged for a Client caller. A professional caller also
    /// reaches this from the All chip, restricted via <paramref name="excludedClientUserIds"/> to
    /// the clients NOT already represented by a live-roster row, so a former/deactivated-link
    /// conversation (including any <c>IsFormer</c> one) still surfaces once, never duplicated with
    /// its roster row.
    /// </summary>
    private async Task<List<ConversationDto>> LoadPlainConversationsAsync(
        bool isProfessional, Guid userGuid, bool archived, CancellationToken ct,
        IReadOnlySet<Guid>? excludedClientUserIds = null)
    {
        var conversations = await db.Conversations
            .AsNoTracking()
            .Where(c => isProfessional ? c.ProfessionalUserId == userGuid : c.ClientUserId == userGuid)
            .Where(c => excludedClientUserIds == null || !excludedClientUserIds.Contains(c.ClientUserId))
            .Where(c => isProfessional
                ? (archived ? c.ArchivedByProfessionalAt != null : c.ArchivedByProfessionalAt == null)
                : (archived ? c.ArchivedByClientAt != null : c.ArchivedByClientAt == null))
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
                        // ClientProfile has no dedicated AvatarBlobUrl; use the user-level avatar.
                        AvatarBlobUrl = c.Client.AvatarBlobUrl,
                        ClientPublicId = c.Client.ClientProfile!.PublicId,
                    }
                    : new ParticipantDto
                    {
                        Id = c.Professional.Id,
                        Name = c.Professional.FirstName + " " + c.Professional.LastName,
                        Initials = (c.Professional.FirstName.Substring(0, 1) + c.Professional.LastName.Substring(0, 1)).ToUpper(),
                        Online = false, // populated below
                        // Prefer the professional-profile avatar; fall back to the user-level avatar.
                        AvatarBlobUrl = c.Professional.ProfessionalProfile != null
                            ? c.Professional.ProfessionalProfile.AvatarBlobUrl ?? c.Professional.AvatarBlobUrl
                            : c.Professional.AvatarBlobUrl,
                        ClientPublicId = null,
                    },
                LastMessage = c.LastMessageText ?? "",
                LastMessageAt = c.LastMessageAt ?? c.DateCreated,
                LastMessageIsOwn = c.LastMessageSenderId == userGuid,
                UnreadCount = c.Messages.Count(m => !m.IsRead && m.SenderUserId != userGuid),
                IsFormer = c.IsFormer,
                LastMessageHasImage = c.LastMessageHasImage,
            })
            .ToListAsync(ct);

        SetPresence(conversations);
        return conversations;
    }

    /// <summary>
    /// Maps a roster row to a <see cref="ConversationDto"/>. <see cref="ConversationDto.Id"/> is
    /// null when the client has no conversation yet — a placeholder row the inbox still lists
    /// (e.g. under NoMessages) without a thread to open until the caller sends the first message.
    /// </summary>
    private static ConversationDto BuildFromRosterRow(ConversationRosterRow row, Guid userGuid) =>
        new()
        {
            Id = row.ConversationPublicId,
            Participant = new ParticipantDto
            {
                Id = row.ClientUserId,
                Name = row.ClientFirstName + " " + row.ClientLastName,
                Initials = (row.ClientFirstName[..1] + row.ClientLastName[..1]).ToUpper(),
                Online = false, // populated below
                AvatarBlobUrl = row.ClientAvatarBlobUrl,
                ClientPublicId = row.ClientPublicId,
            },
            LastMessage = row.LastMessage,
            LastMessageAt = row.LastMessageAt,
            LastMessageIsOwn = row.LastMessageSenderId == userGuid,
            UnreadCount = row.UnreadMessageCount,
            IsFormer = false, // the live roster never includes a former collaboration.
            LastMessageHasImage = row.LastMessageHasImage,
        };

    private void SetPresence(List<ConversationDto> conversations)
    {
        foreach (var c in conversations)
        {
            c.Participant.Online = presence.IsOnline(c.Participant.Id);
        }
    }
}
