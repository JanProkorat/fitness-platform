using FitnessPlatform.Application.Domain.Entities;

namespace FitnessPlatform.Application.Features.ClientMeasurements.Shared;

/// <summary>
/// Data transfer object representing a single body measurement record.
/// </summary>
public class MeasurementDto
{
    /// <summary>
    /// Public identifier of the measurement.
    /// </summary>
    public Guid MeasurementId { get; set; }

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
    /// Maps a <see cref="BodyMeasurement"/> entity to a <see cref="MeasurementDto"/>.
    /// </summary>
    /// <param name="m">The body measurement entity.</param>
    /// <returns>A new measurement DTO.</returns>
    public static MeasurementDto FromEntity(BodyMeasurement m) => new()
    {
        MeasurementId = m.PublicId,
        MeasuredAt = m.MeasuredAt,
        WeightKg = m.WeightKg,
        BodyFatPercentage = m.BodyFatPercentage,
        ChestCm = m.ChestCm,
        WaistCm = m.WaistCm,
        HipsCm = m.HipsCm,
        BicepsCm = m.BicepsCm,
        ThighsCm = m.ThighsCm,
        Notes = m.Notes
    };
}
