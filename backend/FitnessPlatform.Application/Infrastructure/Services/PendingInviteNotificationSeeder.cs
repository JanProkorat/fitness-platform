using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <inheritdoc cref="IPendingInviteNotificationSeeder"/>
public class PendingInviteNotificationSeeder(
    IApplicationDbContext db,
    INotificationService notificationService,
    TimeProvider timeProvider) : IPendingInviteNotificationSeeder
{
    /// <inheritdoc />
    public async Task SeedForNewUserAsync(ApplicationUser newUser, CancellationToken ct)
    {
        var normalizedEmail = newUser.NormalizedEmail ?? newUser.Email?.ToUpperInvariant() ?? string.Empty;

        if (string.IsNullOrEmpty(normalizedEmail))
        {
            return;
        }

        // A coaching account only ever holds silent invite rows, as in CreatePendingInviteEndpoint.
        if (await db.ProfessionalProfiles.AsNoTracking().AnyAsync(pp => pp.UserId == newUser.Id, ct))
        {
            return;
        }

        var validSince = PendingInviteStatusResolver.ValidSince(timeProvider.GetUtcNow().UtcDateTime);

        var invites = await db.PendingInvites
            .AsNoTracking()
            .Include(pi => pi.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(pi => pi.Status == PendingInviteStatus.Pending
                         && pi.SentAt >= validSince
                         && pi.Email.ToUpper() == normalizedEmail
                         && pi.ProfessionalProfile.UserId != newUser.Id)
            .ToListAsync(ct);

        if (invites.Count == 0)
        {
            return;
        }

        // The invite id rides in the notification's JSON payload, so idempotency is a lookup there.
        var existingPayloads = await db.Notifications
            .AsNoTracking()
            .Where(n => n.RecipientUserId == newUser.Id && n.Type == NotificationType.InvitationReceived)
            .Select(n => n.Data)
            .ToListAsync(ct);

        foreach (var invite in invites)
        {
            var inviteId = invite.PublicId.ToString();

            if (existingPayloads.Any(payload => payload is not null && payload.Contains(inviteId)))
            {
                continue;
            }

            var coach = invite.ProfessionalProfile.User;

            await notificationService.CreateAsync(
                newUser.Id,
                NotificationType.InvitationReceived,
                new Dictionary<string, string>
                {
                    ["trainerName"] = $"{coach.FirstName} {coach.LastName}",
                    ["inviteId"] = inviteId,
                },
                ct: ct);
        }
    }
}
