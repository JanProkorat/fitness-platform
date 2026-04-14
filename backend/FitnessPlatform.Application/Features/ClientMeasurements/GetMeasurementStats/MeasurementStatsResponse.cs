namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurementStats;

/// <summary>
/// Aggregated statistics for a client's body weight measurements.
/// </summary>
public class MeasurementStatsResponse
{
    /// <summary>
    /// Minimum recorded weight in kilograms.
    /// </summary>
    public decimal? MinWeight { get; set; }

    /// <summary>
    /// Maximum recorded weight in kilograms.
    /// </summary>
    public decimal? MaxWeight { get; set; }

    /// <summary>
    /// Average recorded weight in kilograms.
    /// </summary>
    public decimal? AvgWeight { get; set; }

    /// <summary>
    /// Most recently recorded weight in kilograms.
    /// </summary>
    public decimal? LatestWeight { get; set; }

    /// <summary>
    /// Weight change over the last 30 days (latest minus ~30 days ago). Positive means gain.
    /// </summary>
    public decimal? WeightChange30Days { get; set; }

    /// <summary>
    /// Total number of measurement records.
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// Client's target weight from onboarding data, if set. Null when no goal was specified.
    /// </summary>
    public decimal? TargetWeightKg { get; set; }
}
