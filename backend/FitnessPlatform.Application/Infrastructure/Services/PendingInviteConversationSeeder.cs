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
