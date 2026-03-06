using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Records a single body measurement session for a client at a point in time.
/// </summary>
public class BodyMeasurement : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientProfile"/>.
    /// </summary>
    public long ClientProfileId { get; set; }

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
    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Navigation property to the client profile.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
