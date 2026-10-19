namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Why an automation occurrence was skipped.
/// </summary>
public enum AutomationSkipReason
{
    /// <summary>The previous request from the rule is still unanswered.</summary>
    PreviousUnanswered = 0,

    /// <summary>The rule is paused for the client.</summary>
    Paused = 1,

    /// <summary>The rule already reached its send limit for the client.</summary>
    StopAfterReached = 2,

    /// <summary>The rule already fired for this plan.</summary>
    AlreadySentForPlan = 3,
}
