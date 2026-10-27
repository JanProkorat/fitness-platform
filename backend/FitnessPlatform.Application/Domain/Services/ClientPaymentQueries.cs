using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Query shapes over a client's payments shared by the endpoints that show them to the client.
/// </summary>
public static class ClientPaymentQueries
{
    /// <summary>
    /// The payments a client may see: those of their own assignments with a coach they still have a link row with.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="clientProfileId">The client's profile id.</param>
    public static IQueryable<ClientPayment> VisibleToClient(IApplicationDbContext db, long clientProfileId) =>
        db.ClientPayments
            .Where(p => p.ClientPaymentAssignment.ClientProfileId == clientProfileId
                && db.ClientProfessionalLinks.Any(l =>
                    l.ClientProfileId == clientProfileId && l.ProfessionalProfileId == p.ProfessionalProfileId));

    /// <summary>
    /// Whether a payment belongs to a collaboration that ended before the current one: a row kept after an end, a
    /// period before the day the current terms began (every period when no terms began after the latest end), or a
    /// one-off created before the latest end. A collaboration that never ended has no earlier payments.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="terms">The assignment's terms history.</param>
    public static bool IsEarlierCollaboration(ClientPayment payment, IReadOnlyCollection<ClientPaymentTerms> terms)
    {
        if (payment.IsKeptAfterEnd)
        {
            return true;
        }

        var latestEnd = LatestEnd(terms);

        if (latestEnd is null)
        {
            return false;
        }

        if (payment.PeriodStart is not { } start)
        {
            return payment.DateCreated < latestEnd;
        }

        var restart = RestartTerms(terms, latestEnd.Value);

        return restart is null || start < ClientPaymentSchedule.Today(restart.EffectiveFromUtc);
    }

    /// <summary>
    /// Whether the assignment has a collaboration running now or restarted after its latest end, so the payments
    /// of earlier collaborations can be told apart from it.
    /// </summary>
    /// <param name="terms">The assignment's terms history.</param>
    public static bool HasCurrentCollaboration(IReadOnlyCollection<ClientPaymentTerms> terms) =>
        LatestEnd(terms) is not { } latestEnd || RestartTerms(terms, latestEnd) is not null;

    /// <summary>
    /// Loads the terms history (without packages) of the given assignments, keyed by assignment.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignmentIds">The assignments' internal ids.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<Dictionary<long, List<ClientPaymentTerms>>> LoadTermsByAssignmentAsync(
        IApplicationDbContext db, IReadOnlyCollection<long> assignmentIds, CancellationToken ct) =>
        (await db.ClientPaymentTerms
            .AsNoTracking()
            .Where(t => assignmentIds.Contains(t.ClientPaymentAssignmentId))
            .ToListAsync(ct))
        .GroupBy(t => t.ClientPaymentAssignmentId)
        .ToDictionary(group => group.Key, group => group.ToList());

    private static DateTime? LatestEnd(IReadOnlyCollection<ClientPaymentTerms> terms) =>
        terms.Where(t => t.EndsAtUtc is not null).Select(t => (DateTime?)t.EndsAtUtc!.Value).Max();

    private static ClientPaymentTerms? RestartTerms(IReadOnlyCollection<ClientPaymentTerms> terms, DateTime latestEnd) =>
        terms
            .Where(t => t.EffectiveFromUtc >= latestEnd)
            .OrderBy(t => t.EffectiveFromUtc)
            .ThenBy(t => t.Id)
            .FirstOrDefault();

    /// <summary>
    /// The payments a coach has asked for (stored status Requested), earliest due first.
    /// </summary>
    /// <param name="visible">A <see cref="VisibleToClient"/> query.</param>
    public static IOrderedQueryable<ClientPayment> RequestedOrdered(IQueryable<ClientPayment> visible) =>
        visible
            .Where(p => p.Status == ClientPaymentStatus.Requested)
            .OrderBy(p => p.DueDate)
            .ThenBy(p => p.Id);
}
