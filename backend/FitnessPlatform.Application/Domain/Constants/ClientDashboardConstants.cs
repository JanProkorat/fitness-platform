namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Named constants for client dashboard / verdict calculations.
/// Centralised here so thresholds are documented and testable in isolation.
/// </summary>
public static class ClientDashboardConstants
{
    /// <summary>
    /// Number of days without any activity (workout log, meal log, or measurement)
    /// that causes the inactivity signal to fire and the verdict to become OffTrack.
    /// </summary>
    public const int InactivityThresholdDays = 14;

    /// <summary>
    /// Compliance percentage at or above which the nutrition signal is considered "on track".
    /// </summary>
    public const decimal ComplianceOnTrackThreshold = 85m;

    /// <summary>
    /// Compliance percentage above which the signal is "needs attention" (60-84%).
    /// Below this threshold it becomes OffTrack.
    /// </summary>
    public const decimal ComplianceNeedsAttentionThreshold = 60m;

    /// <summary>
    /// Weight delta (kg) above which the Away direction triggers OffTrack.
    /// </summary>
    public const decimal WeightOffTrackDeltaKg = 1m;

    /// <summary>
    /// Weight change (kg) below which movement is considered Stable.
    /// </summary>
    public const decimal WeightStableBandKg = 0.5m;

    /// <summary>
    /// Number of days in the rolling window used to compute nutrition compliance.
    /// </summary>
    public const int ComplianceWindowDays = 30;
}
