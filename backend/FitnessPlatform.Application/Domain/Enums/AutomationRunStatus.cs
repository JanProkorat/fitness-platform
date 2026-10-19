namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Outcome of one automation occurrence for one client.
/// </summary>
public enum AutomationRunStatus
{
    /// <summary>The request was sent.</summary>
    Sent = 0,

    /// <summary>The occurrence was skipped; see the skip reason.</summary>
    Skipped = 1,

    /// <summary>Sending failed.</summary>
    Failed = 2,
}
