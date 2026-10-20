namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The date window of one plan a coach wrote for a client — just enough to anchor a plan-event send.
/// </summary>
public sealed class AutomationPlanWindow
{
    /// <summary>The plan's external id; keys a plan-event occurrence and the once-per-plan option.</summary>
    public Guid PlanId { get; init; }

    /// <summary>The client's user id (the key plan documents carry).</summary>
    public Guid ClientId { get; init; }

    /// <summary>First day of the plan; null for an unscheduled plan, which anchors nothing.</summary>
    public DateTime? StartDate { get; init; }

    /// <summary>Number of weeks in the plan.</summary>
    public int WeekCount { get; init; }
}
