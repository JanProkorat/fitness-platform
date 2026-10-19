namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// What a rule covers across the coach's clients right now.
/// </summary>
public class AutomationRuleSummaryDto
{
    /// <summary>Earliest next send (UTC) across the covered clients; null when none is due or computable.</summary>
    public DateTime? NextSendAt { get; set; }

    /// <summary>Number of clients the rule covers.</summary>
    public int ClientCount { get; set; }

    /// <summary>Covered clients that have a custom override of the rule.</summary>
    public int CustomCount { get; set; }

    /// <summary>Covered clients with a pause in effect.</summary>
    public int PausedCount { get; set; }
}
