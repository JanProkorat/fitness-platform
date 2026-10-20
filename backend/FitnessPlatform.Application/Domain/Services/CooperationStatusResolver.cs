using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Current state of one invite or client request a chat cooperation event points at.
/// </summary>
/// <param name="Status">Card status, with invite expiry and request rejection folded in.</param>
/// <param name="RequestedScope">The scope an invite asked for. Always null for a request.</param>
public sealed record CooperationSourceState(CooperationCardStatus Status, LinkCapabilityScope? RequestedScope);

/// <summary>
/// Resolves the current state of invites and client requests by public id, one batched query per table.
/// </summary>
public static class CooperationStatusResolver
{
    /// <summary>
    /// Looks up every id in <paramref name="sourceIds"/> as an invite and as a request.
    /// Ids that match neither are absent from the result.
    /// </summary>
    public static async Task<Dictionary<Guid, CooperationSourceState>> ResolveAsync(
        IApplicationDbContext db,
        IReadOnlyCollection<Guid> sourceIds,
        DateTime now,
        CancellationToken ct)
    {
        var result = new Dictionary<Guid, CooperationSourceState>();

        if (sourceIds.Count == 0)
        {
            return result;
        }

        var invites = await db.PendingInvites
            .AsNoTracking()
            .Where(pi => sourceIds.Contains(pi.PublicId))
            .Select(pi => new { pi.PublicId, pi.Status, pi.SentAt, pi.RequestedScope })
            .ToListAsync(ct);

        foreach (var invite in invites)
        {
            var status = PendingInviteStatusResolver.Resolve(invite.Status, invite.SentAt, now) switch
            {
                PendingInviteStatus.Accepted => CooperationCardStatus.Accepted,
                PendingInviteStatus.Declined => CooperationCardStatus.Declined,
                PendingInviteStatus.Cancelled => CooperationCardStatus.Cancelled,
                PendingInviteStatus.Expired => CooperationCardStatus.Expired,
                _ => CooperationCardStatus.Pending,
            };

            result[invite.PublicId] = new CooperationSourceState(status, invite.RequestedScope);
        }

        var requests = await db.ClientRequests
            .AsNoTracking()
            .Where(cr => sourceIds.Contains(cr.PublicId))
            .Select(cr => new { cr.PublicId, cr.Status })
            .ToListAsync(ct);

        foreach (var request in requests)
        {
            var status = request.Status switch
            {
                ClientRequestStatus.Accepted => CooperationCardStatus.Accepted,
                ClientRequestStatus.Rejected => CooperationCardStatus.Declined,
                ClientRequestStatus.Cancelled => CooperationCardStatus.Cancelled,
                _ => CooperationCardStatus.Pending,
            };

            result[request.PublicId] = new CooperationSourceState(status, null);
        }

        return result;
    }
}
