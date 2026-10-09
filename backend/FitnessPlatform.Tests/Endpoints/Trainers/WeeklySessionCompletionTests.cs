using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Trainers.GetClientDashboard;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FluentAssertions;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Pure tests of the week resolution and completion counting behind the dashboard's
/// "sessions done this week" figures. Every instant is explicit — no wall clock.
/// </summary>
public class WeeklySessionCompletionTests
{
    // Monday 2026-10-05. Week 1 = Oct 5-11, week 2 = Oct 12-18.
    private static readonly DateTime PlanStart = new(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc);

    private static readonly TimeZoneInfo Auckland = TimeZoneInfo.FindSystemTimeZoneById("Pacific/Auckland");
    private static readonly TimeZoneInfo Honolulu = TimeZoneInfo.FindSystemTimeZoneById("Pacific/Honolulu");

    private static TrainingSession Session(int exerciseCount = 2) => new()
    {
        SessionId = Guid.NewGuid(),
        Name = "Session",
        Order = 1,
        StandaloneExercises = Enumerable.Range(1, exerciseCount)
            .Select(i => new SessionExercise
            {
                ExerciseId = Guid.NewGuid(),
                ExerciseExternalId = Guid.NewGuid(),
                ExerciseName = $"Exercise {i}",
                Order = i
            })
            .ToList()
    };

    private static TrainingWeek Week(int number, WeekStatus status, params (int Day, TrainingSession Session)[] sessions) => new()
    {
        WeekNumber = number,
        Status = status,
        Days = TrainingPlanTestHelpers.MaterializeDays(sessions)
    };

    private static TrainingPlan Plan(params TrainingWeek[] weeks) => new()
    {
        ExternalId = Guid.NewGuid(),
        Status = TrainingPlanStatus.Active,
        StartDate = PlanStart,
        Weeks = weeks.ToList()
    };

    private static SessionExecution CompleteByCheckbox(TrainingPlan plan, TrainingSession session, DateTime date) => new()
    {
        ExternalId = Guid.NewGuid(),
        PlanId = plan.ExternalId,
        SessionId = session.SessionId,
        Date = date,
        Status = SessionExecutionStatus.Partial,
        CompletedExerciseInstanceIds = session.StandaloneExercises.Select(e => e.ExerciseId).ToList()
    };

    [Fact]
    public void ResolveWeek_ClientAheadOfUtc_FollowsTheLocalDate()
    {
        var plan = Plan(
            Week(1, WeekStatus.Published, (1, Session())),
            Week(2, WeekStatus.Published, (1, Session())));

        // Sunday 23:30 UTC is already Monday 12:30 in Auckland (UTC+13 in October).
        var instant = new DateTime(2026, 10, 11, 23, 30, 0, DateTimeKind.Utc);

        var utcWeek = WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc);
        var aucklandWeek = WeeklySessionCompletion.ResolveWeek([plan], instant, Auckland);

        utcWeek!.WeekStartUtc.Should().Be(new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc));
        aucklandWeek!.WeekStartUtc.Should().Be(new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc));
        aucklandWeek.WeekEndUtc.Should().Be(new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ResolveWeek_ClientBehindUtc_StaysInThePreviousWeek()
    {
        var plan = Plan(
            Week(1, WeekStatus.Published, (1, Session())),
            Week(2, WeekStatus.Published, (1, Session())));

        // Monday 05:00 UTC is still Sunday 19:00 in Honolulu (UTC-10).
        var instant = new DateTime(2026, 10, 12, 5, 0, 0, DateTimeKind.Utc);

        WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc)!
            .WeekStartUtc.Should().Be(new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc));
        WeeklySessionCompletion.ResolveWeek([plan], instant, Honolulu)!
            .WeekStartUtc.Should().Be(new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ResolveWeek_PlanNotStarted_ReturnsNull()
    {
        var plan = Plan(Week(1, WeekStatus.Published, (1, Session())));

        var instant = new DateTime(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);

        WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc).Should().BeNull();
    }

    [Fact]
    public void ResolveWeek_CurrentWeekPastLastPublishedWeek_ReturnsNull()
    {
        var plan = Plan(
            Week(1, WeekStatus.Published, (1, Session())),
            Week(2, WeekStatus.Draft, (1, Session())));

        var instant = new DateTime(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);

        WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc).Should().BeNull();
    }

    [Fact]
    public void ResolveWeek_NoPublishedWeeks_ReturnsNull()
    {
        var plan = Plan(Week(1, WeekStatus.Draft, (1, Session())));

        var instant = new DateTime(2026, 10, 6, 12, 0, 0, DateTimeKind.Utc);

        WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc).Should().BeNull();
    }

    [Fact]
    public void ResolveWeek_UnpublishedCurrentWeekBeforeLastPublished_FallsBackToEarlierPublishedWeek()
    {
        var earlier = Session();
        var plan = Plan(
            Week(1, WeekStatus.Published, (1, earlier)),
            Week(2, WeekStatus.Draft, (1, Session())),
            Week(3, WeekStatus.Published, (1, Session())));

        var instant = new DateTime(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);

        var week = WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc);

        week!.WeekStartUtc.Should().Be(new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc));
        week.PlannedSessions.Select(s => s.SessionId).Should().Equal(earlier.SessionId);
    }

    [Fact]
    public void ResolveWeek_SessionListedOnTwoDays_IsPlannedOnce()
    {
        var shared = Session();
        var plan = Plan(Week(1, WeekStatus.Published, (1, shared), (4, shared), (6, Session())));

        var instant = new DateTime(2026, 10, 6, 12, 0, 0, DateTimeKind.Utc);

        WeeklySessionCompletion.ResolveWeek([plan], instant, TimeZoneInfo.Utc)!
            .PlannedSessions.Should().HaveCount(2);
    }

    [Fact]
    public void CountCompleted_CountsEachSessionOnceAndNeverExceedsPlanned()
    {
        var first = Session();
        var second = Session();
        var plan = Plan(Week(1, WeekStatus.Published, (1, first), (3, second)));
        var week = WeeklySessionCompletion.ResolveWeek(
            [plan], new DateTime(2026, 10, 7, 12, 0, 0, DateTimeKind.Utc), TimeZoneInfo.Utc)!;

        var monday = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc);
        var executions = new List<SessionExecution>
        {
            CompleteByCheckbox(plan, first, monday),
            CompleteByCheckbox(plan, first, monday.AddDays(1)),
            new()
            {
                ExternalId = Guid.NewGuid(),
                PlanId = plan.ExternalId,
                SessionId = second.SessionId,
                Date = monday.AddDays(2),
                Status = SessionExecutionStatus.Completed
            }
        };

        WeeklySessionCompletion.CountCompleted(week, executions).Should().Be(2);
    }

    [Fact]
    public void CountCompleted_IgnoresPartialOutOfWindowOtherPlanAndAdHocExecutions()
    {
        var session = Session();
        var plan = Plan(Week(1, WeekStatus.Published, (1, session)));
        var week = WeeklySessionCompletion.ResolveWeek(
            [plan], new DateTime(2026, 10, 7, 12, 0, 0, DateTimeKind.Utc), TimeZoneInfo.Utc)!;

        var monday = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc);

        var partial = CompleteByCheckbox(plan, session, monday);
        partial.CompletedExerciseInstanceIds.RemoveAt(0);

        var lastWeek = CompleteByCheckbox(plan, session, monday.AddDays(-1));
        var nextWeek = CompleteByCheckbox(plan, session, monday.AddDays(7));
        var otherPlan = CompleteByCheckbox(plan, session, monday);
        otherPlan.PlanId = Guid.NewGuid();
        var adHoc = CompleteByCheckbox(plan, session, monday);
        adHoc.PlanId = null;
        adHoc.SessionId = null;

        WeeklySessionCompletion.CountCompleted(week, [partial, lastWeek, nextWeek, otherPlan, adHoc])
            .Should().Be(0);
    }
}
