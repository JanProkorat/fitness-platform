namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Response model containing a client's dashboard summary for a trainer.
/// </summary>
public class GetClientDashboardResponse
{
    /// <summary>
    /// The client profile's public ID.
    /// </summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>
    /// The client's email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// The client's first name.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// The client's last name.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// The client's date of birth.
    /// </summary>
    public DateTime? DateOfBirth { get; set; }

    /// <summary>
    /// The client's height in centimeters.
    /// </summary>
    public decimal? HeightCm { get; set; }

    /// <summary>
    /// The client's current weight in kilograms.
    /// </summary>
    public decimal? WeightKg { get; set; }

    /// <summary>
    /// The client's fitness or health goals.
    /// </summary>
    public string? Goals { get; set; }

    /// <summary>
    /// Date when the trainer-client relationship was established.
    /// </summary>
    public DateTime LinkedAt { get; set; }

    /// <summary>
    /// Whether the trainer-client relationship is currently active.
    /// </summary>
    public bool IsActive { get; set; }

    /// <summary>
    /// Total number of body measurements recorded for the client.
    /// </summary>
    public int TotalMeasurements { get; set; }

    /// <summary>
    /// Total number of progress photos uploaded for the client.
    /// </summary>
    public int TotalProgressPhotos { get; set; }

    /// <summary>
    /// The most recent body measurement, or null if none exist.
    /// </summary>
    public LatestMeasurementDto? LatestMeasurement { get; set; }

    /// <summary>
    /// Compliance percentage for the last 7 days (0-100), or null if no active nutrition plan exists.
    /// </summary>
    public decimal? CompliancePercent { get; set; }

    /// <summary>
    /// Current streak of consecutive compliant days.
    /// </summary>
    public int CurrentStreak { get; set; }
}

/// <summary>
/// Summary of the most recent body measurement for a client.
/// </summary>
public class LatestMeasurementDto
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
}
