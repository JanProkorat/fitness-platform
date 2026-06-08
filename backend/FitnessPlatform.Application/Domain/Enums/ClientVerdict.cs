namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Represents the on-track verdict for a client as assessed by the trainer dashboard.
/// </summary>
public enum ClientVerdict
{
    /// <summary>
    /// All active signals are within target thresholds.
    /// </summary>
    OnTrack,

    /// <summary>
    /// Exactly one active signal is off target.
    /// </summary>
    NeedsAttention,

    /// <summary>
    /// At least one critical threshold is breached: compliance below 60%,
    /// inactivity for more than N days, or weight moving Away by more than 1 kg.
    /// </summary>
    OffTrack
}
