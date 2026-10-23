using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Ends a client's package and payments with the collaboration: the terms stop applying, and the periods
/// that were only scheduled for the future are dropped. Periods that already started and anything requested,
/// paid, waived or overdue stay as history.
/// </summary>
public static class ClientPaymentTermsCloser
{
    /// <summary>
    /// Closes the terms of one client with one coach. Does nothing when the pair has no payment terms.
    /// Call it once the collaboration is known to end, before or after the link flips.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="audit">Audit logging service.</param>
    /// <param name="professionalProfileId">The coach's internal id.</param>
    /// <param name="clientProfileId">The client's internal id.</param>
    /// <param name="actorUserId">The user the audit entry is filed for.</param>
    /// <param name="now">The instant the collaboration ends (UTC).</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task CloseAsync(
        IApplicationDbContext db,
        IAuditService audit,
        long professionalProfileId,
        long clientProfileId,
        Guid actorUserId,
        DateTime now,
        CancellationToken ct)
    {
        var assignment = await db.ClientPaymentAssignments
            .AsNoTracking()
            .FirstOrDefaultAsync(
                a => a.ProfessionalProfileId == professionalProfileId && a.ClientProfileId == clientProfileId, ct);

        if (assignment is null || !await db.ClientPaymentTerms.AnyAsync(
                t => t.ClientPaymentAssignmentId == assignment.Id && t.EndsAtUtc == null, ct))
        {
            return;
        }

        // Owed periods that have started but were never listed become rows first, so they survive as history.
        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == professionalProfileId, ct);

        await ClientPaymentSchedule.MaterializeAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, now, ct);

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(professionalProfileId, ct);

        // Terms waiting for a future start never applied; the rest end now.
        await db.ClientPaymentTerms
            .Where(t => t.ClientPaymentAssignmentId == assignment.Id && t.EndsAtUtc == null && t.EffectiveFromUtc > now)
            .ExecuteDeleteAsync(ct);

        var closed = await db.ClientPaymentTerms
            .Where(t => t.ClientPaymentAssignmentId == assignment.Id && t.EndsAtUtc == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.EndsAtUtc, (DateTime?)now), ct);

        var endDay = ClientPaymentSchedule.Today(now);
        var upcoming = (await db.ClientPayments
                .Where(p => p.ClientPaymentAssignmentId == assignment.Id
                    && p.Status == ClientPaymentStatus.Upcoming
                    && p.PeriodStart != null)
                .Select(p => new { p.Id, PeriodStart = p.PeriodStart!.Value })
                .ToListAsync(ct))
            .Where(p => p.PeriodStart > endDay)
            .Select(p => p.Id)
            .ToList();

        if (upcoming.Count > 0)
        {
            await db.ClientPayments.Where(p => upcoming.Contains(p.Id)).ExecuteDeleteAsync(ct);
        }

        if (closed > 0)
        {
            await ClientPaymentAudit.LogAsync(
                audit,
                actorUserId,
                ClientPaymentAudit.EndTerms,
                assignment.PublicId,
                null,
                new { detail = "collaboration ended", removed = upcoming.Count },
                ct);
        }

        await transaction.CommitAsync(ct);
    }
}
