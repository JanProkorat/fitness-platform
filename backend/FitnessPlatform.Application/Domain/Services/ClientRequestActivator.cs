using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Work both ways of accepting a client request share once the link exists: the coach accepting it, or the
/// client accepting the coach's package proposal.
/// </summary>
public static class ClientRequestActivator
{
    /// <summary>
    /// Cancels the client's other open requests (pending, or with a proposal waiting) to professionals of the same role,
    /// tells each of those professionals, and leaves a neutral Withdrawn event in their thread when one exists.
    /// </summary>
    /// <param name="db">Database context; the changes are saved.</param>
    /// <param name="userManager">Resolves the other professionals' identity roles.</param>
    /// <param name="notifier">Realtime notifier.</param>
    /// <param name="notificationService">Notification service.</param>
    /// <param name="conversationSeedService">Writes the Withdrawn event.</param>
    /// <param name="accepted">The request that was accepted; its client profile and user must be loaded.</param>
    /// <param name="roleName">The accepted professional's role, <see cref="AppRoles.Trainer"/> or <see cref="AppRoles.Nutritionist"/>.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task CancelOtherRequestsOfSameRoleAsync(
        IApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        IRealtimeNotifier notifier,
        INotificationService notificationService,
        IConversationSeedService conversationSeedService,
        ClientRequest accepted,
        string roleName,
        CancellationToken ct)
    {
        var otherOpen = await db.ClientRequests
            .Include(r => r.ProfessionalProfile)
                .ThenInclude(pp => pp.User)
            .Where(r => r.ClientProfileId == accepted.ClientProfileId
                     && r.Id != accepted.Id
                     && (r.Status == ClientRequestStatus.Pending || r.Status == ClientRequestStatus.PackageProposed))
            .ToListAsync(ct);

        // Filter by role — need to check each professional's identity role
        var clientUser = accepted.ClientProfile.User;
        var clientName = $"{clientUser.FirstName} {clientUser.LastName}";

        foreach (var other in otherOpen)
        {
            var otherProfRoles = await userManager.GetRolesAsync(other.ProfessionalProfile.User);

            if (!otherProfRoles.Contains(roleName))
            {
                continue;
            }

            other.Status = ClientRequestStatus.Cancelled;
            other.RespondedAt = DateTime.UtcNow;

            await notifier.NotifyAsync(other.ProfessionalProfile.UserId, "clientrequestcancelled", new
            {
                RequestPublicId = other.PublicId,
                ClientName = clientName
            }, ct);

            // A neutral Withdrawn event in the sibling professional's own thread, written only
            // when one already exists (R3) — the client withdrew from that professional's
            // consideration, not this one.
            await conversationSeedService.AppendCooperationEventAsync(
                other.ProfessionalProfile.UserId,
                accepted.ClientProfile.UserId,
                accepted.ClientProfile.UserId,
                ChatEventType.Withdrawn,
                other.PublicId,
                messageText: null,
                createConversationIfMissing: false,
                ct);
        }

        // Save status changes for cancelled requests
        await db.SaveChangesAsync(ct);

        // Now create notifications for cancelled professionals
        foreach (var other in otherOpen.Where(o => o.Status == ClientRequestStatus.Cancelled))
        {
            await notificationService.CreateAsync(
                other.ProfessionalProfile.UserId,
                NotificationType.InvitationCancelled,
                new Dictionary<string, string>
                {
                    ["clientName"] = clientName,
                    ["role"] = roleName.ToLowerInvariant(),
                },
                variant: NotificationTemplates.InvitationCancelledAutoBySibling,
                ct: ct);
        }
    }
}
