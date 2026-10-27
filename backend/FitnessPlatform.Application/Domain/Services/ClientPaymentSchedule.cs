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
    /// The terms in force at an instant: the latest entry effective at or before it, unless that entry
    /// has ended by then.
    /// </summary>
    /// <param name="terms">The assignment's terms history.</param>
    /// <param name="instantUtc">The instant (UTC).</param>
    public static ClientPaymentTerms? TermsAt(IEnumerable<ClientPaymentTerms> terms, DateTime instantUtc)
    {
        var latest = terms
            .Where(t => t.EffectiveFromUtc <= instantUtc)
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .FirstOrDefault();

        return latest is { EndsAtUtc: { } endsAt } && endsAt <= instantUtc ? null : latest;
    }

    /// <summary>
    /// The terms a period starting on a calendar day is priced under. Terms that restart a collaboration part-way
    /// through the day it began own the period starting that day, where <see cref="TermsAt"/> at the start of that
    /// day would still see the ended terms.
    /// </summary>
    /// <param name="terms">The assignment's terms history.</param>
    /// <param name="periodStart">First day of the period.</param>
    public static ClientPaymentTerms? TermsForPeriod(IEnumerable<ClientPaymentTerms> terms, DateOnly periodStart)
    {
        var all = terms as IReadOnlyCollection<ClientPaymentTerms> ?? terms.ToList();

        return RestartingOn(all, periodStart) ?? TermsAt(all, StartOfDayUtc(periodStart));
    }

    /// <summary>
    /// Which recurring payment a period is, counting from 1: only periods since the start of the current
    /// collaboration count, so a fresh start resets the "first N payments" ordinal.
    /// </summary>
    /// <param name="terms">The assignment's terms history.</param>
    /// <param name="recurringPeriodStarts">First days of every recurring payment of the assignment.</param>
    /// <param name="periodStart">First day of the period.</param>
    public static int OrdinalOf(
        IEnumerable<ClientPaymentTerms> terms, IEnumerable<DateOnly> recurringPeriodStarts, DateOnly periodStart)
    {
        var all = terms as IReadOnlyCollection<ClientPaymentTerms> ?? terms.ToList();
        var instant = RestartingOn(all, periodStart)?.EffectiveFromUtc ?? StartOfDayUtc(periodStart);
        var boundary = all
            .Where(t => t.EndsAtUtc is { } endsAt && endsAt <= instant)
            .Select(t => t.EndsAtUtc!.Value)
            .DefaultIfEmpty(DateTime.MinValue)
            .Max();

        if (boundary == DateTime.MinValue)
        {
            return recurringPeriodStarts.Count(other => other <= periodStart);
        }

        var restart = all
            .Where(t => t.EffectiveFromUtc >= boundary)
            .OrderBy(t => t.EffectiveFromUtc)
            .ThenBy(t => t.Id)
            .FirstOrDefault();

        // The restart may begin part-way through a day, so its periods are compared by calendar day.
        return restart is null
            ? recurringPeriodStarts.Count(other => other <= periodStart && StartOfDayUtc(other) >= boundary)
            : recurringPeriodStarts.Count(other =>
                other <= periodStart && other >= ClientLocalDateResolver.ResolveLocalDate(restart.EffectiveFromUtc, Zone));
    }

    /// <summary>
    /// The latest terms that restart a collaboration (they begin at or after another terms' end) part-way through
    /// the given day, or null.
    /// </summary>
    private static ClientPaymentTerms? RestartingOn(IReadOnlyCollection<ClientPaymentTerms> terms, DateOnly day)
    {
        var startUtc = StartOfDayUtc(day);

        return terms
            .Where(t => t.EffectiveFromUtc > startUtc
                && ClientLocalDateResolver.ResolveLocalDate(t.EffectiveFromUtc, Zone) == day
                && terms.Any(other => other.EndsAtUtc is { } endsAt && endsAt <= t.EffectiveFromUtc))
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .FirstOrDefault();
    }

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
    /// <param name="keptPeriodStarts">
    /// First days of rows that were kept from terms that ended (see <see cref="KeptPeriodStarts"/>). They are
    /// part of <paramref name="existingPeriodStarts"/> but take no part in the schedule of later terms.
    /// </param>
    /// <param name="existingPeriods">
    /// The stored first and last day of every row. When given, a restart on a day that already has a row begins
    /// the day after the latest end of the rows covering or following that day; a null end counts as the start day.
    /// When omitted, the restart steps forward from the restart day with the new package's step.
    /// </param>
    /// <returns>The missing periods, oldest first.</returns>
    public static List<(DateOnly Start, DateOnly End)> PlanMissingPeriods(
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IReadOnlyCollection<DateOnly> existingPeriodStarts,
        DateOnly today,
        IReadOnlyCollection<DateOnly>? keptPeriodStarts = null,
        IReadOnlyCollection<(DateOnly Start, DateOnly? End)>? existingPeriods = null)
    {
        var planned = new List<(DateOnly Start, DateOnly End)>();

        if (terms.Count == 0)
        {
            return planned;
        }

        var everyStart = existingPeriodStarts.ToHashSet();
        var existing = existingPeriodStarts.Where(start => keptPeriodStarts?.Contains(start) != true).Order().ToList();
        var runsByTerms = new Dictionary<long, int>();

        foreach (var start in existing)
        {
            if (TermsForPeriod(terms, start) is { } termsOfRow)
            {
                runsByTerms[termsOfRow.Id] = runsByTerms.GetValueOrDefault(termsOfRow.Id) + 1;
            }
        }

        DateOnly? cursor;
        int billingDay;

        if (existing.Count == 0)
        {
            // Only the current collaboration's terms start a schedule; rows kept from an earlier one take no part.
            var latestEndOfAll = terms.Where(t => t.EndsAtUtc is not null).Select(t => t.EndsAtUtc!.Value).DefaultIfEmpty().Max();
            var first = terms
                .Where(t => latestEndOfAll == default || t.EffectiveFromUtc >= latestEndOfAll)
                .OrderBy(t => t.EffectiveFromUtc)
                .ThenBy(t => t.Id)
                .FirstOrDefault()
                ?? terms.OrderBy(t => t.EffectiveFromUtc).ThenBy(t => t.Id).First();
            cursor = ClientLocalDateResolver.ResolveLocalDate(first.EffectiveFromUtc, Zone);
            billingDay = cursor.Value.Day;
        }
        else
        {
            var last = existing[^1];
            billingDay = BillingDayOf(terms, existing);

            if (last > today)
            {
                return planned;
            }

            var lastTerms = TermsForPeriod(terms, last);
            var endedByCollaboration = lastTerms is null || lastTerms.EndsAtUtc is not null;

            cursor = lastTerms is null ? null : NextPeriodStart(last, lastTerms, billingDay);

            if (cursor is null || endedByCollaboration)
            {
                // A single-payment package, or the end of the collaboration, ended the schedule; later terms
                // restart it. After an end the new terms' start day is the billing day.
                // After an end the restart is the first terms that began after the latest end, not the first
                // one after the last row: terms that began and ended on the same day take no part in it.
                var latestEnd = terms
                    .Where(t => t.EndsAtUtc is not null)
                    .Select(t => t.EndsAtUtc!.Value)
                    .DefaultIfEmpty()
                    .Max();

                var restart = terms
                    .Where(t => endedByCollaboration && latestEnd != default
                        ? t.EffectiveFromUtc >= latestEnd
                        : t.EffectiveFromUtc > StartOfDayUtc(last))
                    .OrderBy(t => t.EffectiveFromUtc)
                    .ThenBy(t => t.Id)
                    .FirstOrDefault();

                cursor = restart is null ? null : ClientLocalDateResolver.ResolveLocalDate(restart.EffectiveFromUtc, Zone);

                if (restart is not null && endedByCollaboration)
                {
                    billingDay = cursor!.Value.Day;
                }

                // Terms starting on the day the last period began (an end and a new start on the same day)
                // take over from the next period on.
                if (restart is not null && endedByCollaboration && existingPeriods is not null
                    && cursor is { } rowDay && everyStart.Contains(rowDay))
                {
                    // The rows were built on the old step, so the new terms begin where the latest of them ends.
                    var coveredUntil = existingPeriods
                        .Select(row => row.End ?? row.Start)
                        .Where(end => end >= rowDay)
                        .DefaultIfEmpty(rowDay)
                        .Max();

                    cursor = coveredUntil.AddDays(1);
                    billingDay = cursor.Value.Day;
                }
                else
                {
                    while (restart is not null && cursor is { } restartDay && everyStart.Contains(restartDay))
                    {
                        cursor = NextPeriodStart(restartDay, restart, billingDay);
                    }
                }
            }
        }

        var keptStarts = keptPeriodStarts?.ToList() ?? [];

        // Only rows that begin on or after the restart day can push the new terms' periods forward: a kept row
        // that began earlier belongs to the earlier collaboration and may overlap the restart.
        var latestRestartDay = terms
            .Where(t => terms.Any(other => other.EndsAtUtc is { } endsAt && endsAt <= t.EffectiveFromUtc))
            .OrderByDescending(t => t.EffectiveFromUtc)
            .ThenByDescending(t => t.Id)
            .Select(t => (DateOnly?)ClientLocalDateResolver.ResolveLocalDate(t.EffectiveFromUtc, Zone))
            .FirstOrDefault();
        var spansFromRestart = latestRestartDay is { } restartFrom
            ? existingPeriods?.Where(row => row.Start >= restartFrom).ToList()
            : null;

        while (cursor is { } candidate)
        {
            // A period never begins inside a stored row's span: it begins the day after the latest end covering it.
            var start = SkipCoveredDays(candidate, spansFromRestart);

            if (start != candidate)
            {
                billingDay = start.Day;
            }

            var termsOfPeriod = TermsForPeriod(terms, start);

            if (termsOfPeriod is null)
            {
                break;
            }

            // A kept row that starts after today is already the first period after today.
            if (start > today && keptStarts.Any(keptStart => keptStart > today && keptStart < start))
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
            var end = next is { } following ? following.AddDays(-1) : start;
            var keptAhead = keptStarts.Where(keptStart => keptStart > start && keptStart <= end).DefaultIfEmpty().Min();

            if (keptAhead != default)
            {
                // The period would run into a kept row: it ends the day before it, and the schedule resumes after it.
                end = keptAhead.AddDays(-1);
                next = keptAhead;
            }

            // A row that starts on this day already covers it; it is not planned twice.
            if (!everyStart.Contains(start))
            {
                planned.Add((start, end));
                runsByTerms[termsOfPeriod.Id] = usedRuns + 1;
            }

            // Stop at the first period after today, unless a kept row still lies ahead: the days up to it must be covered.
            if (start > today && !keptStarts.Any(keptStart => keptStart > start))
            {
                break;
            }

            cursor = next;
        }

        return planned;
    }

    /// <summary>
    /// Moves a day that falls inside a stored row's span to the day after the latest end covering it.
    /// Rows without an end cover nothing beyond their first day and are left to the caller.
    /// </summary>
    private static DateOnly SkipCoveredDays(DateOnly day, List<(DateOnly Start, DateOnly? End)>? rows)
    {
        if (rows is null)
        {
            return day;
        }

        while (rows.Where(row => row.End is { } end && row.Start <= day && day <= end).Select(row => row.End!.Value).ToList() is { Count: > 0 } covering)
        {
            day = covering.Max().AddDays(1);
        }

        return day;
    }

    /// <summary>
    /// The first days of rows kept for the coach when a collaboration ended (<see cref="ClientPayment.IsKeptAfterEnd"/>).
    /// They belong to no later terms, so the "first N payments" ordinal and the schedule of a returning client ignore them.
    /// </summary>
    /// <param name="payments">The assignment's payments.</param>
    public static List<DateOnly> KeptPeriodStarts(IEnumerable<ClientPayment> payments) =>
        payments.Where(p => p.IsKeptAfterEnd && p.PeriodStart is not null).Select(p => p.PeriodStart!.Value).ToList();

    /// <summary>
    /// First days of the assignment's recurring payments that count toward the ordinal of later periods: every
    /// recurring payment except the kept ones.
    /// </summary>
    /// <param name="payments">The assignment's payments.</param>
    public static List<DateOnly> RecurringStartsOf(IReadOnlyCollection<ClientPayment> payments) =>
        payments.Where(p => !p.IsKeptAfterEnd && p.PeriodStart is not null).Select(p => p.PeriodStart!.Value).ToList();

    /// <summary>
    /// Loads <see cref="RecurringStartsOf"/> for an assignment.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignmentId">The assignment's internal id.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<List<DateOnly>> LoadRecurringStartsAsync(
        IApplicationDbContext db, long assignmentId, CancellationToken ct) =>
        RecurringStartsOf(
            await db.ClientPayments
                .AsNoTracking()
                .Where(p => p.ClientPaymentAssignmentId == assignmentId && p.PeriodStart != null)
                .ToListAsync(ct));

    /// <summary>
    /// The billing day of existing periods: the day of the first period starting on or after the latest end of
    /// the collaboration (a restart picks its own day), or of the first period ever when nothing ended. Days are
    /// compared as calendar days, so a restart later on the day of the end still counts.
    /// </summary>
    private static int BillingDayOf(IReadOnlyCollection<ClientPaymentTerms> terms, List<DateOnly> orderedStarts)
    {
        var endedAt = terms
            .Where(t => t.EndsAtUtc is not null)
            .Select(t => t.EndsAtUtc!.Value)
            .DefaultIfEmpty()
            .Max();

        var sinceEnd = endedAt == default
            ? orderedStarts
            : orderedStarts.Where(start => start >= ClientLocalDateResolver.ResolveLocalDate(endedAt, Zone)).ToList();

        return (sinceEnd.Count > 0 ? sinceEnd[0] : orderedStarts[0]).Day;
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
            return (basePrice, custom, 0m, null, true);
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
        var unit = discount.Type == DiscountType.Percentage
            ? " %"
            : $" {PaymentMessageComposer.CurrencySymbol(discount.Currency ?? PaymentCurrency.CZK)}";

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
    public static (decimal? Amount, decimal? BasePrice, string? DiscountLabel, string? PackageName, bool IsCustomPrice) FiguresOf(
        ClientPayment payment,
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IReadOnlyCollection<DateOnly> recurringPeriodStarts)
    {
        // An upcoming row that already has an amount was frozen when its collaboration ended.
        if (payment.Status != ClientPaymentStatus.Upcoming || payment.PeriodStart is not { } start || payment.Amount is not null)
        {
            return (
                payment.Amount,
                payment.BasePrice,
                payment.DiscountLabel,
                payment.PackageName ?? payment.Title,
                payment.IsCustomPrice);
        }

        if (TermsForPeriod(terms, start) is not { } termsOfPeriod)
        {
            return (null, null, null, null, false);
        }

        var ordinal = OrdinalOf(terms, recurringPeriodStarts, start);
        var breakdown = Breakdown(termsOfPeriod, start, ordinal, payment.DueDate);

        return (breakdown.Amount, breakdown.BasePrice, breakdown.Label, termsOfPeriod.CoachPackage.Name, breakdown.IsCustomPrice);
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
        payment.IsCustomPrice = figures.IsCustomPrice;

        if (payment.Kind == ClientPaymentKind.Recurring)
        {
            payment.PackageName ??= figures.PackageName;

            if (payment.Status == ClientPaymentStatus.Upcoming
                && payment.PeriodStart is { } start
                && TermsForPeriod(terms, start) is { } termsOfPeriod)
            {
                payment.Currency = termsOfPeriod.CoachPackage.Currency;
            }
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
    /// Counts the coach's clients whose current terms use each package and each discount. A client's current
    /// terms are the latest entry of their terms history, unless it has ended with the collaboration.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="professionalProfileId">The coach's internal id.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task<(Dictionary<long, int> ByPackage, Dictionary<long, int> ByDiscount)> CountCurrentUsageAsync(
        IApplicationDbContext db, long professionalProfileId, CancellationToken ct)
    {
        var rows = await db.ClientPaymentTerms
            .AsNoTracking()
            .Where(t => t.ClientPaymentAssignment.ProfessionalProfileId == professionalProfileId)
            .Select(t => new { t.ClientPaymentAssignmentId, t.Id, t.EffectiveFromUtc, t.EndsAtUtc, t.CoachPackageId, t.CoachDiscountId })
            .ToListAsync(ct);

        var current = rows
            .GroupBy(t => t.ClientPaymentAssignmentId)
            .Select(group => group.OrderByDescending(t => t.EffectiveFromUtc).ThenByDescending(t => t.Id).First())
            .Where(t => t.EndsAtUtc is null)
            .ToList();

        return (
            current.GroupBy(t => t.CoachPackageId).ToDictionary(group => group.Key, group => group.Count()),
            current.Where(t => t.CoachDiscountId is not null)
                .GroupBy(t => t.CoachDiscountId!.Value)
                .ToDictionary(group => group.Key, group => group.Count()));
    }

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

        if ((await PlanAsync(db, assignment.Id, terms, today, ct)).Count == 0)
        {
            return;
        }

        await using var transaction = await db.BeginTransactionAsync(ct);
        await db.LockProfessionalProfileAsync(assignment.ProfessionalProfileId, ct);

        terms = await LoadTermsAsync(db, assignment.Id, ct);

        await InsertPeriodsAsync(db, assignment, variableSymbolFormat, terms, await PlanAsync(db, assignment.Id, terms, today, ct), ct);

        await transaction.CommitAsync(ct);
    }

    /// <summary>
    /// Creates the rows of the planned periods one by one, each with its own variable symbol. The caller holds
    /// the coach lock inside a transaction.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignment">The assignment (id, coach and client number are read).</param>
    /// <param name="variableSymbolFormat">How the coach's variable symbols are derived.</param>
    /// <param name="terms">The assignment's terms history, packages loaded.</param>
    /// <param name="planned">The periods to create.</param>
    /// <param name="ct">Cancellation token.</param>
    internal static async Task InsertPeriodsAsync(
        IApplicationDbContext db,
        ClientPaymentAssignment assignment,
        VariableSymbolFormat variableSymbolFormat,
        IReadOnlyCollection<ClientPaymentTerms> terms,
        IEnumerable<(DateOnly Start, DateOnly End)> planned,
        CancellationToken ct)
    {
        foreach (var (start, end) in planned)
        {
            var used = await UsedVariableSymbolsAsync(db, assignment.ProfessionalProfileId, start, ct);

            db.ClientPayments.Add(new ClientPayment
            {
                ClientPaymentAssignmentId = assignment.Id,
                ProfessionalProfileId = assignment.ProfessionalProfileId,
                Kind = ClientPaymentKind.Recurring,
                Status = ClientPaymentStatus.Upcoming,
                Currency = TermsForPeriod(terms, start)?.CoachPackage.Currency ?? PaymentCurrency.CZK,
                PeriodStart = start,
                PeriodEnd = end,
                DueDate = start,
                VariableSymbol = VariableSymbolGenerator.Generate(variableSymbolFormat, start, assignment.ClientNumber, used)
            });

            // Each new symbol must be visible to the next period's lookup, so save row by row.
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Plans the missing periods of an assignment against its stored rows.
    /// </summary>
    /// <param name="db">Application database context.</param>
    /// <param name="assignmentId">The assignment's internal id.</param>
    /// <param name="terms">The assignment's terms history, packages loaded.</param>
    /// <param name="today">Today in <see cref="Zone"/>.</param>
    /// <param name="ct">Cancellation token.</param>
    internal static async Task<List<(DateOnly Start, DateOnly End)>> PlanAsync(
        IApplicationDbContext db, long assignmentId, IReadOnlyCollection<ClientPaymentTerms> terms, DateOnly today, CancellationToken ct)
    {
        var payments = await db.ClientPayments
            .AsNoTracking()
            .Where(p => p.ClientPaymentAssignmentId == assignmentId && p.PeriodStart != null)
            .ToListAsync(ct);

        return PlanMissingPeriods(
            terms,
            payments.Select(p => p.PeriodStart!.Value).ToList(),
            today,
            KeptPeriodStarts(payments),
            payments.Select(p => (p.PeriodStart!.Value, p.PeriodEnd)).ToList());
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
}
