using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Stores the package, and the discount or custom price, a client pays under, and creates the billing periods
/// that follow. Shared by the coach setting terms by hand and by an accepted invite that carries a package.
/// </summary>
/// <param name="db">Application database context.</param>
/// <param name="audit">Audit logging service.</param>
public sealed class ClientPaymentTermsWriter(IApplicationDbContext db, IAuditService audit)
{
    /// <summary>
    /// Stores the terms (and the assignment, on first use) in one transaction under the coach lock, then
    /// materializes the billing periods. The caller has already checked that the package and discount may be
    /// used (<see cref="PackageTermsRules"/>).
    /// </summary>
    /// <param name="professionalProfileId">The coach's internal id.</param>
    /// <param name="clientProfileId">The client's internal id.</param>
    /// <param name="packageId">The package's internal id.</param>
    /// <param name="discountId">The discount's internal id, or null for none.</param>
    /// <param name="customPrice">A custom price replacing the package price, or null.</param>
    /// <param name="firstPeriodStart">The day the first period starts; null means today.</param>
    /// <param name="actorUserId">The user the audit entry is filed for.</param>
    /// <param name="ipAddress">The caller's IP address, for the audit entry.</param>
    /// <param name="now">The current instant (UTC).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The assignment, or null when the coach has no client number left.</returns>
    public async Task<ClientPaymentAssignment?> StoreAsync(
        long professionalProfileId,
        long clientProfileId,
        long packageId,
        long? discountId,
        decimal? customPrice,
        DateOnly? firstPeriodStart,
        Guid actorUserId,
        string? ipAddress,
        DateTime now,
        CancellationToken ct)
    {
        var package = await db.CoachPackages.AsNoTracking().FirstAsync(p => p.Id == packageId, ct);
        var discount = discountId is null
            ? null
            : await db.CoachDiscounts.AsNoTracking().FirstAsync(d => d.Id == discountId, ct);

        var assignment = await StoreTermsAsync(
            professionalProfileId, clientProfileId, package, discount, customPrice, firstPeriodStart,
            actorUserId, ipAddress, now, ct);

        if (assignment is null)
        {
            return null;
        }

        var settings = await db.CoachPaymentSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProfessionalProfileId == professionalProfileId, ct);

        await ClientPaymentSchedule.MaterializeAsync(
            db, assignment, settings?.VariableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber, now, ct);

        return assignment;
    }

    private async Task<ClientPaymentAssignment?> StoreTermsAsync(
        long professionalProfileId,
        long clientProfileId,
        CoachPackage package,
        CoachDiscount? discount,
        decimal? customPrice,
        DateOnly? firstPeriodStart,
        Guid actorUserId,
        string? ipAddress,
        DateTime now,
        CancellationToken ct)
    {
        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(professionalProfileId, ct);

        var assignment = await ClientPaymentAssignments.GetOrCreateAsync(db, professionalProfileId, clientProfileId, ct);

        if (assignment is null)
        {
            return null;
        }

        var latest = await db.ClientPaymentTerms
            .Where(t => t.ClientPaymentAssignmentId == assignment.Id)
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .FirstOrDefaultAsync(ct);

        var unchanged = latest is not null
            && latest.CoachPackageId == package.Id
            && latest.CoachDiscountId == discount?.Id
            && latest.CustomPrice == customPrice;

        if (!unchanged)
        {
            var hasPeriods = await db.ClientPayments
                .AnyAsync(p => p.ClientPaymentAssignmentId == assignment.Id && p.PeriodStart != null, ct);

            // The first terms start the schedule on the chosen day. Later terms apply from now, so a period that
            // has started keeps its price; terms still waiting for a future start are replaced in place.
            var effectiveFrom = hasPeriods && latest is not null
                ? (latest.EffectiveFromUtc > now ? latest.EffectiveFromUtc : now)
                : ClientPaymentSchedule.StartOfDayUtc(firstPeriodStart ?? ClientPaymentSchedule.Today(now));

            db.ClientPaymentTerms.Add(new ClientPaymentTerms
            {
                ClientPaymentAssignmentId = assignment.Id,
                CoachPackageId = package.Id,
                CoachDiscountId = discount?.Id,
                CustomPrice = customPrice,
                EffectiveFromUtc = effectiveFrom
            });
            await db.SaveChangesAsync(ct);

            // Upcoming periods that start under the new terms were made from the old ones; drop them (their
            // variable symbols go with them) and let the schedule create them again. Requested, paid and
            // waived rows are locked and stay.
            // A change of discount or custom price keeps the periods: their amounts follow the terms anyway.
            var staleIds = latest is not null && latest.CoachPackageId == package.Id
                ? new List<long>()
                : (await db.ClientPayments
                    .Where(p => p.ClientPaymentAssignmentId == assignment.Id
                        && p.Status == ClientPaymentStatus.Upcoming
                        && p.PeriodStart != null)
                    .Select(p => new { p.Id, PeriodStart = p.PeriodStart!.Value })
                    .ToListAsync(ct))
                .Where(p => ClientPaymentSchedule.StartOfDayUtc(p.PeriodStart) >= effectiveFrom)
                .Select(p => p.Id)
                .ToList();

            if (staleIds.Count > 0)
            {
                await db.ClientPayments.Where(p => staleIds.Contains(p.Id)).ExecuteDeleteAsync(ct);
            }

            await ClientPaymentAudit.LogAsync(
                audit,
                actorUserId,
                ClientPaymentAudit.SetTerms,
                assignment.PublicId,
                ipAddress,
                new
                {
                    detail = package.Name,
                    discount = discount?.Name,
                    amount = customPrice,
                    currency = package.Currency.ToString(),
                    removed = staleIds.Count
                },
                ct);
        }

        await transaction.CommitAsync(ct);

        return assignment;
    }
}
