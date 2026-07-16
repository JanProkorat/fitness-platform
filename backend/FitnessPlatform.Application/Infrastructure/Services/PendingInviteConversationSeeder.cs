using FitnessPlatform.Application.Domain.Entities;
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
            // seedIntoExisting: false — intentional "one conversation per coach" behavior.
            // If this coach has already sent a message-bearing invite to this email before
            // (so the professional/client conversation already exists from a prior loop
            // iteration or an earlier invite-creation-time seed), a SECOND message-bearing
            // invite from the SAME coach reuses that existing conversation and does NOT
            // seed its message again — matching AcceptClientInviteEndpoint /
            // AcceptInvitationEndpoint's re-accept idempotency. This is deliberate, not a
            // bug: it prevents a coach who re-invites the same client from re-delivering
            // (or duplicating) an old opening message. Only distinct coaches inviting the
            // same email each get their own conversation seeded here.
            //
            // Match the existing accept-time gate (AcceptClientInviteEndpoint /
            // AcceptInvitationEndpoint): only seed for invites carrying a non-empty
            // message — never create an empty conversation shell for a message-less invite.
            if (string.IsNullOrWhiteSpace(invite.Message))
            {
                continue;
            }

            var professionalUser = invite.ProfessionalProfile.User;
            var professionalName = $"{professionalUser.FirstName} {professionalUser.LastName}";

            await conversationSeedService.GetOrSeedConversationAsync(
                invite.ProfessionalProfile.UserId,
                newUser.Id,
                invite.ProfessionalProfile.UserId,
                professionalName,
                invite.Message,
                seedIntoExisting: false,
                ct: ct);
        }
    }
}
