namespace FitnessPlatform.Application.Features.ClientMeasurements.AddMeasurement;

/// <summary>
/// Request model for adding a new body measurement.
/// </summary>
public class AddMeasurementRequest
{
    /// <summary>
    /// Date and time when the measurement was taken.
    /// </summary>
    public DateTime MeasuredAt { get; set; }

    /// <summary>
    /// Weight in kilograms.
    /// </summary>
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// Body fat percentage.
    /// </summary>
    public decimal? BodyFatPercentage { get; set; }

    /// <summary>
    /// Chest circumference in centimeters.
    /// </summary>
    public decimal? ChestCm { get; set; }

    /// <summary>
    /// Waist circumference in centimeters.
    /// </summary>
    public decimal? WaistCm { get; set; }

    /// <summary>
    /// Hips circumference in centimeters.
    /// </summary>
    public decimal? HipsCm { get; set; }

    /// <summary>
    /// Biceps circumference in centimeters.
    /// </summary>
    public decimal? BicepsCm { get; set; }

    /// <summary>
    /// Thighs circumference in centimeters.
    /// </summary>
    public decimal? ThighsCm { get; set; }

    /// <summary>
    /// Optional notes about the measurement session.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// When the client queued the measurement (offline sync); validated against the 7-day
    /// offline window only. <c>MeasuredAt</c> still decides the measurement's own date.
    /// </summary>
    public DateTimeOffset? OccurredAt { get; set; }

    /// <summary>Client-generated id that makes a retried request apply only once.</summary>
    public Guid? ClientRequestId { get; set; }

    /// <summary>The <c>NutritionPlan.Version</c> the client saw when it queued the request.</summary>
    public int? BasedOnPlanVersion { get; set; }
}
