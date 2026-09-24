using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <inheritdoc cref="IPendingInviteConversationSeeder"/>
public class PendingInviteConversationSeeder(
    IApplicationDbContext db,
    IConversationSeedService conversationSeedService) : IPendingInviteConversationSeeder
{
    /// <inheritdoc />
    public async Task SeedForNewUserAsync(ApplicationUser newUser, CancellationToken ct)
    {
        // Use NormalizedEmail (uppercase, set by Identity) for reliable matching — same
        // idiom as GetPendingInviteEndpoint / AcceptClientInviteEndpoint /
        // DeclineClientInviteEndpoint. PendingInvite.Email stores the original casing from
        // the professional, so compare using UPPER() on both sides.
        var normalizedEmail = newUser.NormalizedEmail ?? newUser.Email?.ToUpperInvariant() ?? string.Empty;

        if (string.IsNullOrEmpty(normalizedEmail))
        {
            return;
        }

        // A client can have multiple pending invites from different coaches — seed one
        // conversation per qualifying invite, not just the newest.
        var invites = await db.PendingInvites
            .Include(pi => pi.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(pi => !pi.IsAccepted && pi.Email.ToUpper() == normalizedEmail)
            .ToListAsync(ct);

        foreach (var invite in invites)
        {
            // Writes the SAME rows the immediate verified-account path in
            // CreatePendingInviteEndpoint writes: the Invited event, then the invite's
            // message beneath it if it carries one. A message-less invite still gets a
            // thread here — the banner alone (R4 + the maintainer's message-less=yes
            // ruling) — this is no longer gated on a non-empty Message the way the
            // pre-#1100 seeder was.
            //
            // Keyed on invite.PublicId via the (conversation, eventType, sourceId) unique
            // index inside AppendCooperationEventAsync, so this is idempotent: a no-op if
            // the immediate invite-time path already wrote it for an account that was
            // already verified when the invite was created, and a later accept's own
            // "ensure Invited" re-check is likewise a no-op against this row.
            await conversationSeedService.AppendCooperationEventAsync(
                invite.ProfessionalProfile.UserId,
                newUser.Id,
                invite.ProfessionalProfile.UserId,
                ChatEventType.Invited,
                invite.PublicId,
                invite.Message,
                createConversationIfMissing: true,
                ct);
        }
    }
}
