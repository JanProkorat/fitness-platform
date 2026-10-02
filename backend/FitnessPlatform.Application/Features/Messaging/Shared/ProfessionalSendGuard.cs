using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>What a professional may do in a thread with one client.</summary>
public enum ProfessionalSendAccess
{
    /// <summary>No link has ever existed and no join request is pending — an invite-only thread.</summary>
    Locked,

    /// <summary>May send; the message must not un-archive the thread (ended link or pending request).</summary>
    SendOnly,

    /// <summary>May send and un-archive the thread (live link).</summary>
    SendAndUnarchive,
}

/// <summary>
/// Decides whether a professional may send into a thread. Only a thread with no link ever and no
/// pending join request is locked: an invite-only thread the client has not accepted. Ended links
/// keep sending as before.
/// </summary>
public static class ProfessionalSendGuard
{
    /// <summary>Evaluates the access of one professional to one client.</summary>
    public static async Task<ProfessionalSendAccess> EvaluateAsync(
        IApplicationDbContext db, Guid professionalUserId, Guid clientUserId, CancellationToken ct)
    {
        var access = await EvaluateManyAsync(db, professionalUserId, [clientUserId], ct);
        return access[clientUserId];
    }

    /// <summary>Evaluates the access of one professional to many clients in at most two queries.</summary>
    public static async Task<Dictionary<Guid, ProfessionalSendAccess>> EvaluateManyAsync(
        IApplicationDbContext db, Guid professionalUserId, IReadOnlyCollection<Guid> clientUserIds, CancellationToken ct)
    {
        var result = clientUserIds.Distinct().ToDictionary(id => id, _ => ProfessionalSendAccess.Locked);

        if (result.Count == 0)
        {
            return result;
        }

        var ids = result.Keys.ToList();

        var links = await db.ClientProfessionalLinks
            .AsNoTracking()
            .Where(l => l.ProfessionalProfile.UserId == professionalUserId && ids.Contains(l.ClientProfile.UserId))
            .Select(l => new { ClientUserId = l.ClientProfile.UserId, l.IsActive })
            .ToListAsync(ct);

        foreach (var link in links)
        {
            if (link.IsActive)
            {
                result[link.ClientUserId] = ProfessionalSendAccess.SendAndUnarchive;
            }
            else if (result[link.ClientUserId] == ProfessionalSendAccess.Locked)
            {
                result[link.ClientUserId] = ProfessionalSendAccess.SendOnly;
            }
        }

        var unresolved = result.Where(pair => pair.Value == ProfessionalSendAccess.Locked).Select(pair => pair.Key).ToList();

        if (unresolved.Count > 0)
        {
            var pendingClientUserIds = await db.ClientRequests
                .AsNoTracking()
                .Where(r =>
                    r.ProfessionalProfile.UserId == professionalUserId &&
                    unresolved.Contains(r.ClientProfile.UserId) &&
                    r.Status == ClientRequestStatus.Pending)
                .Select(r => r.ClientProfile.UserId)
                .Distinct()
                .ToListAsync(ct);

            foreach (var clientUserId in pendingClientUserIds)
            {
                result[clientUserId] = ProfessionalSendAccess.SendOnly;
            }
        }

        return result;
    }

    /// <summary>
    /// Writes the 403 <see cref="ErrorCodes.ConversationLocked"/> response and returns
    /// <see langword="null"/> when the thread is locked; otherwise returns the access level.
    /// </summary>
    public static async Task<ProfessionalSendAccess?> RequireProfessionalAccessOrRespondAsync(
        this IEndpoint endpoint, IApplicationDbContext db, Guid professionalUserId, Guid clientUserId, CancellationToken ct)
    {
        var access = await EvaluateAsync(db, professionalUserId, clientUserId, ct);

        if (access != ProfessionalSendAccess.Locked)
        {
            return access;
        }

        await endpoint.SendProblemAsync(
            403, ErrorCodes.ConversationLocked, "The client has not accepted the invitation yet.", ct);
        return null;
    }
}
