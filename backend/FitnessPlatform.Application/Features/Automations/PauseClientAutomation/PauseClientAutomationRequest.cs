namespace FitnessPlatform.Application.Features.Automations.PauseClientAutomation;

/// <summary>
/// Request for pausing or resuming a global rule for one client.
/// </summary>
public class PauseClientAutomationRequest
{
    /// <summary>Route parameter: public id of the client profile.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }

    /// <summary>True to pause, false to resume.</summary>
    public bool IsPaused { get; set; }

    /// <summary>Last client-local day of the pause; only with IsPaused. Null pauses until resumed.</summary>
    public DateOnly? PausedUntil { get; set; }

    /// <summary>Short note about the pause (at most 200 characters); only with IsPaused.</summary>
    public string? PauseNote { get; set; }
}
