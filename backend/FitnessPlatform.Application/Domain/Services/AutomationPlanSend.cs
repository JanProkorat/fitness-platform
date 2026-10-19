namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// One plan-event send that falls due: which plan, the event date it hangs on, and the instant it is sent.
/// </summary>
/// <param name="PlanId">The plan's external id.</param>
/// <param name="Anchor">The plan's start date or last day, whichever the event names.</param>
/// <param name="SendAt">The send instant (UTC).</param>
public sealed record AutomationPlanSend(Guid PlanId, DateOnly Anchor, DateTime SendAt);
