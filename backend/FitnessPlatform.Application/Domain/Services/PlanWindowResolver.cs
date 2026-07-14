namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Resolves which plan (nutrition or training) is "current" for a given date out of a client's
/// set of same-type plans, now that a client may have several sequential, non-overlapping plans
/// of the same type (#780).
/// </summary>
/// <remarks>
/// A plan's window is <c>[StartDate, StartDate + WeekCount * 7)</c> — half-open, so a plan's last
/// day is <c>StartDate + WeekCount * 7 - 1</c>. Weeks carry no persisted dates; a week's date is
/// always derived as <c>StartDate + (WeekNumber - 1) * 7</c> (see
/// <c>Features/ClientTraining/PlanWeekCalculator</c>), so the window is fully determined by
/// <c>StartDate</c> and the plan's total week count.
///
/// Plans without a <c>StartDate</c> (e.g. legacy data, or a Draft plan that hasn't been scheduled
/// yet) are "unranged": they never match <see cref="ResolveCurrentPlan{T}"/> and never participate
/// in <see cref="WindowsOverlap"/> — they neither claim a date nor block one.
///
/// This type is deliberately generic over the document type in <see cref="ResolveCurrentPlan{T}"/>
/// rather than coupled to <c>NutritionPlan</c> / <c>TrainingPlan</c> — those two Mongo documents
/// share no common interface (and adding one is out of scope for #780; it would touch the
/// document shapes). The caller supplies simple property selectors instead.
/// </remarks>
public static class PlanWindowResolver
{
    /// <summary>
    /// Returns whether <paramref name="today"/> falls within the plan's window
    /// <c>[StartDate, StartDate + WeekCount * 7)</c>.
    /// </summary>
    public static bool IsWithinWindow(DateTime startDate, int weekCount, DateOnly today)
    {
        var start = DateOnly.FromDateTime(startDate);
        var end = start.AddDays(weekCount * 7); // exclusive
        return today >= start && today < end;
    }

    /// <summary>
    /// Returns whether two plan windows overlap (share at least one day). Both windows are
    /// half-open: <c>[start, start + weekCount * 7)</c>.
    /// </summary>
    public static bool WindowsOverlap(DateTime aStartDate, int aWeekCount, DateTime bStartDate, int bWeekCount)
    {
        var aStart = DateOnly.FromDateTime(aStartDate);
        var aEnd = aStart.AddDays(aWeekCount * 7);
        var bStart = DateOnly.FromDateTime(bStartDate);
        var bEnd = bStart.AddDays(bWeekCount * 7);
        return aStart < bEnd && bStart < aEnd;
    }

    /// <summary>
    /// Selects the plan out of <paramref name="plans"/> whose window contains <paramref name="now"/>
    /// (compared as a UTC date). <paramref name="plans"/> should already be pre-filtered to the
    /// client + status the caller cares about (e.g. <c>Status == Active</c>) — this method only
    /// applies the date-window selection on top.
    /// </summary>
    /// <returns>
    /// The single matching plan, or <c>null</c> when none of the candidates' windows contain
    /// <paramref name="now"/>. Callers must surface a <c>null</c> result as the endpoint's
    /// existing "no plan for today" state — never fall back to an arbitrary candidate.
    /// </returns>
    /// <remarks>
    /// Deterministic regardless of the input's enumeration order: under the non-overlap invariant
    /// enforced at plan creation (#780 Task 3) at most one Active same-type plan's window should
    /// ever contain a given day, but the tiebreak (latest <c>StartDate</c> wins) guards against a
    /// pre-existing data anomaly still producing a stable answer instead of an order-dependent one.
    ///
    /// <para>
    /// <b>Legacy single-plan fallback:</b> plans created before the <c>StartDate</c> field existed
    /// have no window at all. Before #780, a client could only ever have ONE Active same-type plan
    /// (enforced by the publish auto-archive), so an unranged legacy plan was unambiguously "the"
    /// current plan. To avoid regressing that historical data, when <paramref name="plans"/>
    /// contains exactly one candidate AND it is unranged (no <c>StartDate</c>), that plan is
    /// returned as-is — callers already have their own legacy <c>DatePublished</c>-based cycling
    /// logic downstream for this case (see e.g. <c>GetTodayPlanEndpoint</c>). This fallback is
    /// intentionally restricted to the single-candidate case: once a client has more than one
    /// same-type plan (the #780 scenario this resolver exists for), an unranged plan has no window
    /// to disambiguate against a sibling that DOES have one, so it must not be favoured by default.
    /// </para>
    /// </remarks>
    public static T? ResolveCurrentPlan<T>(
        IEnumerable<T> plans,
        Func<T, DateTime?> startDateSelector,
        Func<T, int> weekCountSelector,
        DateTime now)
        where T : class
    {
        var planList = plans as IReadOnlyCollection<T> ?? plans.ToList();
        var today = DateOnly.FromDateTime(now);

        var inWindow = planList
            .Where(p => startDateSelector(p) is not null)
            .Where(p => IsWithinWindow(startDateSelector(p)!.Value, weekCountSelector(p), today))
            .OrderByDescending(p => startDateSelector(p)!.Value)
            .FirstOrDefault();

        if (inWindow is not null)
            return inWindow;

        // Legacy single-plan fallback — see remarks above.
        if (planList.Count == 1)
        {
            var only = planList.First();
            if (startDateSelector(only) is null)
                return only;
        }

        return null;
    }
}
