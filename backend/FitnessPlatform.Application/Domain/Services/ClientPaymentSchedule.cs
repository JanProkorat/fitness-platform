using System.Globalization;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The billing schedule of a client's payments: which periods exist, what an upcoming period costs, and the
/// derived overdue status. Periods are created on demand (no scheduler): <see cref="MaterializeAsync"/> adds
/// every period up to and including the first one after today.
/// </summary>
/// <remarks>
/// All dates are calendar days in Europe/Prague, whatever the time zone of the coach or the client, so a
/// payment is overdue for both of them at the same moment.
/// </remarks>
public static class ClientPaymentSchedule
{
    /// <summary>Largest client number a coach can hand out.</summary>
    public const int MaxClientNumber = 9999;

    /// <summary>Largest amount a payment can carry; it must fit the QR code.</summary>
    public const decimal MaxAmount = SpaydBuilder.MaxAmount;

    /// <summary>The zone that decides what "today" is for every payment.</summary>
    public static TimeZoneInfo Zone { get; } = ClientLocalDateResolver.ResolveTimeZone("Europe/Prague");

    /// <summary>
    /// The calendar day an instant falls on in <see cref="Zone"/>.
    /// </summary>
    /// <param name="utcNow">The instant (UTC).</param>
    public static DateOnly Today(DateTime utcNow) => ClientLocalDateResolver.ResolveLocalDate(utcNow, Zone);

    /// <summary>
    /// The instant a calendar day starts in <see cref="Zone"/> (UTC).
    /// </summary>
    /// <param name="date">The calendar day.</param>
    public static DateTime StartOfDayUtc(DateOnly date) =>
        ClientLocalDateResolver.ResolveLocalDayWindowUtc(date, Zone).StartUtc;

    /// <summary>
    /// The terms in force at an instant: the latest entry effective at or before it.
    /// </summary>
    /// <param name="terms">The assignment's terms history.</param>
    /// <param name="instantUtc">The instant (UTC).</param>
    public static ClientPaymentTerms? TermsAt(IEnumerable<ClientPaymentTerms> terms, DateTime instantUtc) =>
        terms
            .Where(t => t.EffectiveFromUtc <= instantUtc)
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .FirstOrDefault();

    /// <summary>
    /// The first day of the period after the one starting on <paramref name="current"/>, or null when the
    /// package bills once.
    /// </summary>
    /// <param name="current">First day of the current period.</param>
    /// <param name="terms">The terms in force for the current period; their package must be loaded.</param>
    /// <param name="billingDay">The day of the month monthly periods start on; short months clamp to their last day.</param>
    public static DateOnly? NextPeriodStart(DateOnly current, ClientPaymentTerms terms, int billingDay)
    {
        var package = terms.CoachPackage;

        switch (package.Billing)
        {
            case PackageBillingInterval.Monthly:
                var firstOfNext = new DateOnly(current.Year, current.Month, 1).AddMonths(1);

                return new DateOnly(
                    firstOfNext.Year,
                    firstOfNext.Month,
                    Math.Min(billingDay, DateTime.DaysInMonth(firstOfNext.Year, firstOfNext.Month)));
            case PackageBillingInterval.EveryNWeeks:
                return current.AddDays(7 * Math.Max(1, package.IntervalWeeks ?? 1));
            default:
                return null;
        }
    }

    /// <summary>
    /// Works out which periods are missing: every period that has started up to today, plus the first one
    /// after today, within the number of payments each package runs for.
    /// </summary>
    /// <param name="terms">The assignment's terms history, packages loaded.</param>
    /// <param name="existingPeriodStarts">First days of the periods that already have a row.</param>
    /// <param name="today">Today in <see cref="Zone"/>.</param>
    /// <returns>The missing periods, oldest first.</returns>
    public static List<(DateOnly Start, DateOnly End)> PlanMissingPeriods(
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IReadOnlyCollection<DateOnly> existingPeriodStarts,
        DateOnly today)
    {
        var planned = new List<(DateOnly Start, DateOnly End)>();

        if (terms.Count == 0)
        {
            return planned;
        }

        var existing = existingPeriodStarts.Order().ToList();
        var runsByTerms = new Dictionary<long, int>();

        foreach (var start in existing)
        {
            if (TermsAt(terms, StartOfDayUtc(start)) is { } termsOfRow)
            {
                runsByTerms[termsOfRow.Id] = runsByTerms.GetValueOrDefault(termsOfRow.Id) + 1;
            }
        }

        DateOnly? cursor;
        int billingDay;

        if (existing.Count == 0)
        {
            var first = terms.OrderBy(t => t.EffectiveFromUtc).ThenBy(t => t.Id).First();
            cursor = ClientLocalDateResolver.ResolveLocalDate(first.EffectiveFromUtc, Zone);
            billingDay = cursor.Value.Day;
        }
        else
        {
            var last = existing[^1];
            billingDay = existing[0].Day;

            if (last > today)
            {
                return planned;
            }

            cursor = TermsAt(terms, StartOfDayUtc(last)) is { } lastTerms
                ? NextPeriodStart(last, lastTerms, billingDay)
                : null;

            if (cursor is null)
            {
                // A single-payment package ended the schedule; later terms with a new package restart it.
                var restart = terms
                    .Where(t => t.EffectiveFromUtc > StartOfDayUtc(last))
                    .OrderBy(t => t.EffectiveFromUtc)
                    .ThenBy(t => t.Id)
                    .FirstOrDefault();

                cursor = restart is null ? null : ClientLocalDateResolver.ResolveLocalDate(restart.EffectiveFromUtc, Zone);
            }
        }

        while (cursor is { } start)
        {
            var termsOfPeriod = TermsAt(terms, StartOfDayUtc(start));

            if (termsOfPeriod is null)
            {
                break;
            }

            var package = termsOfPeriod.CoachPackage;
            var allowedRuns = package.Billing == PackageBillingInterval.OneOff ? 1 : package.RunsForPayments;
            var usedRuns = runsByTerms.GetValueOrDefault(termsOfPeriod.Id);

            if (allowedRuns is { } allowed && usedRuns >= allowed)
            {
                break;
            }

            var next = NextPeriodStart(start, termsOfPeriod, billingDay);

            planned.Add((start, next is { } following ? following.AddDays(-1) : start));
            runsByTerms[termsOfPeriod.Id] = usedRuns + 1;

            if (start > today)
            {
                break;
            }

            cursor = next;
        }

        return planned;
    }

    /// <summary>
    /// The package price that applies to a period: the price history entry in force when the period starts.
    /// </summary>
    /// <param name="terms">The terms in force for the period; their package and its prices must be loaded.</param>
    /// <param name="periodStart">First day of the period.</param>
    public static decimal BasePrice(ClientPaymentTerms terms, DateOnly periodStart) =>
        CoachPackagePricing.ResolvePrice(terms.CoachPackage.Prices, StartOfDayUtc(periodStart))
        ?? terms.CoachPackage.Price;

    /// <summary>
    /// Prices a period under some terms: a custom price replaces the package price and any discount; otherwise
    /// the discount applies when its rules allow it for this payment.
    /// </summary>
    /// <param name="terms">The terms in force for the period; package, prices and discount must be loaded.</param>
    /// <param name="periodStart">First day of the period.</param>
    /// <param name="ordinal">Which recurring payment this is, counting from 1 and counting waived ones.</param>
    /// <param name="dueDate">The payment's due date.</param>
    public static (decimal BasePrice, decimal Amount, decimal DiscountAmount, string? Label, bool IsCustomPrice) Breakdown(
        ClientPaymentTerms terms, DateOnly periodStart, int ordinal, DateOnly dueDate)
    {
        var basePrice = BasePrice(terms, periodStart);

        if (terms.CustomPrice is { } custom)
        {
            return (basePrice, custom, 0m, "Custom price", true);
        }

        if (terms.CoachDiscount is { } discount && CoachDiscountRules.Applies(discount, ordinal, dueDate))
        {
            var discounted = CoachDiscountRules.Apply(discount, basePrice);

            return (basePrice, discounted, basePrice - discounted, DiscountLabel(discount), false);
        }

        return (basePrice, basePrice, 0m, null, false);
    }

    /// <summary>
    /// The label of a discount as shown next to a price: "Friends &amp; family −30 %" or "Spring −200 Kč".
    /// </summary>
    /// <param name="discount">The discount.</param>
    public static string DiscountLabel(CoachDiscount discount)
    {
        var value = discount.Value.ToString("0.##", CultureInfo.InvariantCulture);
        var unit = discount.Type == DiscountType.Percentage ? " %" : " Kč";

        return $"{discount.Name} −{value}{unit}";
    }

    /// <summary>
    /// Applies the derived overdue status: a payment still waiting for the money is overdue once its due date has passed.
    /// </summary>
    /// <param name="stored">The stored status.</param>
    /// <param name="dueDate">The due date.</param>
    /// <param name="today">Today in <see cref="Zone"/>.</param>
    public static ClientPaymentStatus DerivedStatus(ClientPaymentStatus stored, DateOnly dueDate, DateOnly today) =>
        stored is ClientPaymentStatus.Upcoming or ClientPaymentStatus.Requested && dueDate < today
            ? ClientPaymentStatus.Overdue
            : stored;

    /// <summary>
    /// What a payment shows as its amount, price breakdown and package name: the frozen values, or for an
    /// upcoming recurring payment the figures its terms give right now.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="terms">The assignment's terms history, packages and discounts loaded.</param>
    /// <param name="recurringPeriodStarts">First days of every recurring payment of the assignment.</param>
    public static (decimal? Amount, decimal? BasePrice, string? DiscountLabel, string? PackageName) FiguresOf(
        ClientPayment payment,
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IReadOnlyCollection<DateOnly> recurringPeriodStarts)
    {
        if (payment.Status != ClientPaymentStatus.Upcoming || payment.PeriodStart is not { } start)
        {
            return (payment.Amount, payment.BasePrice, payment.DiscountLabel, payment.PackageName ?? payment.Title);
        }

        if (TermsAt(terms, StartOfDayUtc(start)) is not { } termsOfPeriod)
        {
            return (null, null, null, null);
        }

        var ordinal = recurringPeriodStarts.Count(other => other <= start);
        var breakdown = Breakdown(termsOfPeriod, start, ordinal, payment.DueDate);

        return (breakdown.Amount, breakdown.BasePrice, breakdown.Label, termsOfPeriod.CoachPackage.Name);
    }

    /// <summary>
    /// Writes the current figures onto the payment so they stop following the client's terms.
    /// </summary>
    /// <param name="payment">The payment; its amount stays when it already has one.</param>
    /// <param name="terms">The assignment's terms history, packages and discounts loaded.</param>
    /// <param name="recurringPeriodStarts">First days of every recurring payment of the assignment.</param>
    public static void Freeze(
        ClientPayment payment,
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IReadOnlyCollection<DateOnly> recurringPeriodStarts)
    {
        var figures = FiguresOf(payment, terms, recurringPeriodStarts);

        payment.Amount ??= figures.Amount;
        payment.BasePrice ??= figures.BasePrice;
        payment.DiscountLabel ??= figures.DiscountLabel;

        if (payment.Kind == ClientPaymentKind.Recurring)
        {
            payment.PackageName ??= figures.PackageName;
        }
    }

    /// <summary>
    /// Loads an assignment's terms history with the packages (and their price history) and discounts the prices need.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignmentId">The assignment's internal id.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<ClientPaymentTerms>> LoadTermsAsync(
        IApplicationDbContext db, long assignmentId, CancellationToken ct) =>
        await db.ClientPaymentTerms
            .AsNoTracking()
            .Where(t => t.ClientPaymentAssignmentId == assignmentId)
            .Include(t => t.CoachPackage).ThenInclude(p => p.Prices)
            .Include(t => t.CoachDiscount)
            .OrderBy(t => t.EffectiveFromUtc).ThenBy(t => t.Id)
            .ToListAsync(ct);

    /// <summary>
    /// Creates the missing period rows of an assignment: every period up to today and the first one after.
    /// Safe to call from concurrent requests: the rows are created under a lock on the coach, and the
    /// periods are planned again once the lock is held.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignment">The assignment (id, coach and client number are read).</param>
    /// <param name="variableSymbolFormat">How the coach's variable symbols are derived.</param>
    /// <param name="utcNow">The current instant (UTC).</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task MaterializeAsync(
        IApplicationDbContext db,
        ClientPaymentAssignment assignment,
        VariableSymbolFormat variableSymbolFormat,
        DateTime utcNow,
        CancellationToken ct)
    {
        var today = Today(utcNow);
        var terms = await LoadTermsAsync(db, assignment.Id, ct);

        if (PlanMissingPeriods(terms, await ExistingPeriodStartsAsync(db, assignment.Id, ct), today).Count == 0)
        {
            return;
        }

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(assignment.ProfessionalProfileId, ct);

        var planned = PlanMissingPeriods(terms, await ExistingPeriodStartsAsync(db, assignment.Id, ct), today);

        foreach (var (start, end) in planned)
        {
            var used = await UsedVariableSymbolsAsync(db, assignment.ProfessionalProfileId, start, ct);

            db.ClientPayments.Add(new ClientPayment
            {
                ClientPaymentAssignmentId = assignment.Id,
                ProfessionalProfileId = assignment.ProfessionalProfileId,
                Kind = ClientPaymentKind.Recurring,
                Status = ClientPaymentStatus.Upcoming,
                PeriodStart = start,
                PeriodEnd = end,
                DueDate = start,
                VariableSymbol = VariableSymbolGenerator.Generate(variableSymbolFormat, start, assignment.ClientNumber, used)
            });

            // Each new symbol must be visible to the next period's lookup, so save row by row.
            await db.SaveChangesAsync(ct);
        }

        await transaction.CommitAsync(ct);
    }

    /// <summary>
    /// Every variable symbol the coach already holds for a month (the month of <paramref name="referenceDate"/>).
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="professionalProfileId">The coach's internal id.</param>
    /// <param name="referenceDate">Any day of the month.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<HashSet<string>> UsedVariableSymbolsAsync(
        IApplicationDbContext db, long professionalProfileId, DateOnly referenceDate, CancellationToken ct)
    {
        var prefix = $"{referenceDate.Year:D4}{referenceDate.Month:D2}";
        var symbols = await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ProfessionalProfileId == professionalProfileId
                && p.VariableSymbol != null
                && p.VariableSymbol.StartsWith(prefix))
            .Select(p => p.VariableSymbol!)
            .ToListAsync(ct);

        return symbols.ToHashSet();
    }

    private static async Task<List<DateOnly>> ExistingPeriodStartsAsync(
        IApplicationDbContext db, long assignmentId, CancellationToken ct) =>
        await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ClientPaymentAssignmentId == assignmentId && p.PeriodStart != null)
            .Select(p => p.PeriodStart!.Value)
            .ToListAsync(ct);
}
