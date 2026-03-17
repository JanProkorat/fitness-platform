namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;

/// <summary>
/// Request model for listing body measurements with optional date filtering and pagination.
/// </summary>
public class GetMeasurementsRequest
{
    /// <summary>
    /// Optional start date filter (inclusive).
    /// </summary>
    public DateTime? From { get; set; }

    /// <summary>
    /// Optional end date filter (inclusive).
    /// </summary>
    public DateTime? To { get; set; }

    /// <summary>
    /// Page number (1-based).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
