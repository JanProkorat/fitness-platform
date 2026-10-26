using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Ends a client's package and payments with the collaboration: the terms stop applying. Periods that already
/// started and anything requested, paid, waived or overdue stay as history. Of the periods only scheduled for
/// the future, an indefinite package drops them; a fixed-length package keeps all its payments, with the
/// remaining periods created now and their figures frozen.
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

        var endDay = ClientPaymentSchedule.Today(now);
        var kept = await KeepFixedLengthPeriodsAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, endDay, ct);

        // The end falls after every row created above, so those rows are told apart from a later restart's.
        var lastCreated = await db.ClientPayments
            .Where(p => p.ClientPaymentAssignmentId == assignment.Id)
            .Select(p => (DateTime?)p.DateCreated)
            .MaxAsync(ct);
        var endsAt = lastCreated is { } created && created > now ? created : now;

        var closed = await db.ClientPaymentTerms
            .Where(t => t.ClientPaymentAssignmentId == assignment.Id && t.EndsAtUtc == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.EndsAtUtc, (DateTime?)endsAt), ct);

        var upcoming = kept
            ? []
            : (await db.ClientPayments
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

    /// <summary>
    /// For terms whose package runs for a fixed number of payments, creates every payment still to come and
    /// freezes the figures of the ones starting after the end day, so they stay payable once the terms ended.
    /// Returns false (and does nothing) for an indefinite or single-payment package. The caller holds the coach
    /// lock inside a transaction and has not yet ended the terms.
    /// </summary>
    private static async Task<bool> KeepFixedLengthPeriodsAsync(
        IApplicationDbContext db,
        ClientPaymentAssignment assignment,
        VariableSymbolFormat variableSymbolFormat,
        DateOnly endDay,
        CancellationToken ct)
    {
        var terms = await ClientPaymentSchedule.LoadTermsAsync(db, assignment.Id, ct);
        var open = terms.LastOrDefault(t => t.EndsAtUtc == null);

        if (open is null || open.CoachPackage.Billing == PackageBillingInterval.OneOff || open.CoachPackage.RunsForPayments is null)
        {
            return false;
        }

        // The package's own run count bounds the plan; the far-off date only lifts the "up to today" limit.
        var planned = await ClientPaymentSchedule.PlanAsync(db, assignment.Id, terms, endDay.AddYears(200), ct);
        await ClientPaymentSchedule.InsertPeriodsAsync(db, assignment, variableSymbolFormat, terms, planned, ct);

        var payments = await db.ClientPayments
            .Where(p => p.ClientPaymentAssignmentId == assignment.Id && p.PeriodStart != null)
            .ToListAsync(ct);
        var recurringStarts = ClientPaymentSchedule.RecurringStartsOf(terms, payments);

        foreach (var payment in payments.Where(p => p.Status == ClientPaymentStatus.Upcoming && p.PeriodStart > endDay))
        {
            ClientPaymentSchedule.Freeze(payment, terms, recurringStarts);
        }

        await db.SaveChangesAsync(ct);

        return true;
    }
}
