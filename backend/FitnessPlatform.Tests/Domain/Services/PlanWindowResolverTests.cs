using FluentAssertions;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit tests for <see cref="PlanWindowResolver"/> — the date-window-aware "current plan"
/// selector introduced for #780 (multiple sequential, non-overlapping plans per client).
/// </summary>
public class PlanWindowResolverTests
{
    private sealed record FakePlan(Guid Id, DateTime? StartDate, int WeekCount);

    [Fact]
    public void ResolveCurrentPlan_SinglePlanWithTodayInWindow_ReturnsIt()
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var plan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc), 2);

        var result = PlanWindowResolver.ResolveCurrentPlan(
            [plan], p => p.StartDate, p => p.WeekCount, today);

        result.Should().Be(plan);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ResolveCurrentPlan_TwoNonOverlappingPlans_ReturnsInWindowPlanRegardlessOfOrder(bool reversed)
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);

        // January plan — window fully elapsed by March.
        var januaryPlan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc), 2);
        // March plan — window contains "today".
        var marchPlan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc), 2);

        var candidates = reversed
            ? new List<FakePlan> { marchPlan, januaryPlan }
            : new List<FakePlan> { januaryPlan, marchPlan };

        var result = PlanWindowResolver.ResolveCurrentPlan(
            candidates, p => p.StartDate, p => p.WeekCount, today);

        result.Should().Be(marchPlan, "the resolver must deterministically pick the in-window plan regardless of input order");
    }

    [Fact]
    public void ResolveCurrentPlan_NoPlanWindowContainsToday_ReturnsNull()
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);

        var pastPlan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc), 2);
        var futurePlan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc), 2);

        var result = PlanWindowResolver.ResolveCurrentPlan(
            [pastPlan, futurePlan], p => p.StartDate, p => p.WeekCount, today);

        result.Should().BeNull("neither plan's window contains today — must surface the no-plan state, not an arbitrary plan");
    }

    /// <summary>
    /// Legacy single-plan fallback: a plan predating the StartDate field has no window, but
    /// when it's the client's ONLY same-type plan (the situation for every plan created before
    /// #780 — the publish auto-archive kept it that way), it must still resolve as "current" so
    /// existing legacy DatePublished-cycling logic downstream keeps working.
    /// </summary>
    [Fact]
    public void ResolveCurrentPlan_SoleCandidateWithoutStartDate_ReturnsItAsLegacyFallback()
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var unrangedPlan = new FakePlan(Guid.NewGuid(), null, 2);

        var result = PlanWindowResolver.ResolveCurrentPlan(
            [unrangedPlan], p => p.StartDate, p => p.WeekCount, today);

        result.Should().Be(unrangedPlan);
    }

    /// <summary>
    /// The legacy single-plan fallback must NOT apply once there is more than one candidate —
    /// an unranged plan has no window to disambiguate against a sibling that does, so with two
    /// candidates present it must never be favoured by default.
    /// </summary>
    [Fact]
    public void ResolveCurrentPlan_UnrangedPlanAlongsideRangedSibling_NotSelectedWhenNeitherInWindow()
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);
        var unrangedPlan = new FakePlan(Guid.NewGuid(), null, 2);
        // Ranged sibling whose window does NOT contain today either.
        var pastPlan = new FakePlan(Guid.NewGuid(), new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc), 2);

        var result = PlanWindowResolver.ResolveCurrentPlan(
            [unrangedPlan, pastPlan], p => p.StartDate, p => p.WeekCount, today);

        result.Should().BeNull("with >1 candidate, an unranged plan must not be favoured by default");
    }

    [Fact]
    public void ResolveCurrentPlan_EmptyCandidateList_ReturnsNull()
    {
        var today = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc);

        var result = PlanWindowResolver.ResolveCurrentPlan(
            Array.Empty<FakePlan>(), p => p.StartDate, p => p.WeekCount, today);

        result.Should().BeNull();
    }

    [Fact]
    public void IsWithinWindow_FirstDayOfWindow_ReturnsTrue()
    {
        var start = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var today = DateOnly.FromDateTime(start);

        PlanWindowResolver.IsWithinWindow(start, 2, today).Should().BeTrue();
    }

    [Fact]
    public void IsWithinWindow_LastDayOfWindow_ReturnsTrue()
    {
        // 2-week window: [Mar 2, Mar 16) — last valid day is Mar 15.
        var start = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var lastDay = DateOnly.FromDateTime(start.AddDays(13));

        PlanWindowResolver.IsWithinWindow(start, 2, lastDay).Should().BeTrue();
    }

    [Fact]
    public void IsWithinWindow_DayAfterWindowEnds_ReturnsFalse()
    {
        // Half-open window: the day the next window would start is NOT included.
        var start = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var dayAfterEnd = DateOnly.FromDateTime(start.AddDays(14));

        PlanWindowResolver.IsWithinWindow(start, 2, dayAfterEnd).Should().BeFalse();
    }

    [Fact]
    public void WindowsOverlap_IdenticalWindows_ReturnsTrue()
    {
        var start = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);

        PlanWindowResolver.WindowsOverlap(start, 2, start, 2).Should().BeTrue();
    }

    [Fact]
    public void WindowsOverlap_PartiallyOverlappingWindows_ReturnsTrue()
    {
        var aStart = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        // B starts 1 week into A's 2-week window — overlaps the second week.
        var bStart = aStart.AddDays(7);

        PlanWindowResolver.WindowsOverlap(aStart, 2, bStart, 2).Should().BeTrue();
    }

    [Fact]
    public void WindowsOverlap_AdjacentWindows_ReturnsFalse()
    {
        // A: [Mar 2, Mar 16). B starts exactly on Mar 16 (the day A's window ends) —
        // half-open windows must NOT be considered overlapping.
        var aStart = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var bStart = aStart.AddDays(14);

        PlanWindowResolver.WindowsOverlap(aStart, 2, bStart, 2).Should().BeFalse();
    }

    [Fact]
    public void WindowsOverlap_NonOverlappingWindows_ReturnsFalse()
    {
        var aStart = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
        var bStart = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);

        PlanWindowResolver.WindowsOverlap(aStart, 2, bStart, 2).Should().BeFalse();
    }
}
