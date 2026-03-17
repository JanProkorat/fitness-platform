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
}
